import db from '../config/db';
import { EmailService } from './email.service';
import { EmitirReciboDto, GenerarCuotasDto, UpdateReciboDto } from '../dtos/recibo.dto.js';
import { EstadoCita, EstadoPago, Prisma, MetodoPago, TipoRecibo, TipoTransaccion } from '@prisma/client';
import { DatosPapeleta } from '../dtos/email.dto.js';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service.js';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { anulaPapeleta, puedeCobrarse, puedeTransicionar, requiereReverso, ESTADOS_COBRABLES } from '../domain/recibo-estados.js';
import { CLAVES_EVENTO, datosEvento, type DatosEvento } from '../domain/datos-procesion.js';
import { enmascararEmail } from '../utils/log-privacidad.js';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';

type Tx = Prisma.TransactionClient;

const CATEGORIA_INGRESOS = 'Cuotas y papeletas';
const CATEGORIA_DEVOLUCIONES = 'Devoluciones de recibos';
const MENSAJE_ESTADO_CAMBIADO = 'El estado del recibo ha cambiado. Recarga la ficha e inténtalo de nuevo.';

// Una cuota en estos estados sigue en pie: impide emitir otra el mismo año.
// EXENTO no está a propósito: la exención es una decisión de la Junta y, si se
// revoca, hay que poder emitirle la cuota (EXENTO es final y no vuelve a
// PENDIENTE). El precio es que Tesorería podría emitírsela por error a un
// exento; se aceptó así en la revisión del 11-09-2026.
const ESTADOS_CUOTA_VIVA = [EstadoPago.PENDIENTE, EstadoPago.REMESADO, EstadoPago.PAGADO] as const;

/** Lo que se guarda en la auditoría de un recibo: sin objetos Decimal, que no son JSON. */
function fotoRecibo(r: { estado: EstadoPago; importe: Prisma.Decimal | number; metodoPago?: MetodoPago | null; observaciones?: string | null }) {
  return {
    estado: r.estado,
    importe: String(r.importe),
    metodoPago: r.metodoPago ?? null,
    ...(r.observaciones !== undefined ? { observaciones: r.observaciones } : {})
  };
}

export class ReciboService {

  static async getAdminRecibos(query: { page?: unknown; limit?: unknown } = {}, year?: number, estado?: EstadoPago) {
    const paginacion = sanearPaginacion(query);
    const where = {
      ...(year ? { year } : {}),
      ...(estado ? { estado } : {})
    };

    const [data, total] = await db.$transaction([
      db.recibo.findMany({
        where,
        orderBy: [
          { year: 'desc' },
          { createdAt: 'desc' },
          { id: 'asc' } // Desempate: los recibos emitidos de una tacada comparten `createdAt`
                        // —MariaDB evalúa DEFAULT CURRENT_TIMESTAMP una vez por sentencia, así
                        // que un createMany deja a todos con el mismo—, el orden degenera a
                        // ordenar solo por año y uno saldría en dos páginas y otro en ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
        select: {
          id: true, year: true, concepto: true, importe: true, fechaEmision: true,
          estado: true, fechaPago: true, metodoPago: true, observaciones: true, tipo: true,
          hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true } }
        }
      }),
      db.recibo.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  /**
   * Buscador de hermanos de la ventana «Nuevo recibo».
   *
   * Tesorería no tiene acceso al buscador del censo (es de Secretaría), y para
   * emitir un recibo solo necesita saber a quién: nombre, apellidos y número.
   * Nada de DNI, dirección ni contacto. Solo hermanos activos, que son los
   * únicos a los que se les emite. Cada palabra tiene que aparecer en el nombre
   * o en los apellidos, para que «ana pérez» encuentre a Ana Pérez Ruiz.
   */
  static async buscarHermanos(q: string) {
    const palabras = q.trim().split(/\s+/).filter(Boolean);
    const numero = /^\d{1,9}$/.test(q.trim()) ? Number(q.trim()) : null;

    return db.hermano.findMany({
      where: {
        activo: true,
        OR: [
          { AND: palabras.map((p) => ({ OR: [{ nombre: { contains: p } }, { apellidos: { contains: p } }] })) },
          ...(numero !== null ? [{ numeroHermano: numero }] : [])
        ]
      },
      select: { id: true, nombre: true, apellidos: true, numeroHermano: true },
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }, { id: 'asc' }],
      take: 10
    });
  }

  /**
   * Fecha, hora y puerta de la salida que se imprimen en la papeleta. Una sola
   * fuente para el cobro en tesorería y la inscripción en mesa; el orden de
   * preferencia está en `domain/datos-procesion.ts`.
   */
  static async leerDatosEvento(): Promise<DatosEvento> {
    const filas = await db.configuracion.findMany({
      where: { key: { in: Object.values(CLAVES_EVENTO) } }
    });
    return datosEvento(Object.fromEntries(filas.map((f) => [f.key, f.value])));
  }

  // =================================================================
  //  1. GENERACIÓN MASIVA Y EMISIÓN SUELTA (ADMIN)
  // =================================================================
  static async generarCuotaAnual({ year, importe, concepto }: GenerarCuotasDto, meta?: AuditMeta) {
    const conceptoLimpio = concepto.trim();

    // Serializable: dos «Generar» seguidos (o dos tesoreros a la vez) leerían
    // los mismos hermanos pendientes y emitirían la cuota dos veces.
    const resultado = await transactionWithRetry(async (tx) => {
      const hermanosActivos = await tx.hermano.findMany({
        where: { activo: true },
        select: { id: true, formaPagoPref: true }
      });
      if (hermanosActivos.length === 0) throw new HttpError('No hay hermanos activos.');

      // Ya tiene su cuota quien tenga un recibo de tipo CUOTA_HERMANO ese año,
      // se llame como se llame. Antes se miraba solo el texto del concepto:
      // generar «Cuota 2026» después de «Cuota anual» cobraba dos veces a todo
      // el censo. También se salta a quien ya tenga un recibo con este mismo
      // concepto, de otro tipo: chocaría con la clave única y tumbaría la
      // generación entera.
      const recibosExistentes = await tx.recibo.findMany({
        where: { year, OR: [{ tipo: TipoRecibo.CUOTA_HERMANO }, { concepto: conceptoLimpio }] },
        select: { hermanoId: true }
      });
      const hermanosConRecibo = new Set(recibosExistentes.map(r => r.hermanoId));
      const hermanosPendientes = hermanosActivos.filter(h => !hermanosConRecibo.has(h.id));

      if (hermanosPendientes.length === 0) {
        return { creados: 0, omitidos: hermanosActivos.length };
      }

      const fechaActual = new Date();
      const creados = await tx.recibo.createMany({
        data: hermanosPendientes.map(h => ({
          hermanoId: h.id,
          year,
          importe: new Prisma.Decimal(importe),
          concepto: conceptoLimpio,
          tipo: TipoRecibo.CUOTA_HERMANO,
          estado: EstadoPago.PENDIENTE,
          // Si el hermano tiene domiciliación, el recibo nace sabiendo que se
          // pagará así. Si no, se queda en null hasta que venga a pagarlo en mano.
          metodoPago: h.formaPagoPref === 'DOMICILIACION' ? MetodoPago.DOMICILIACION : undefined,
          createdAt: fechaActual,
          updatedAt: fechaActual
        }))
      });

      return { creados: creados.count, omitidos: hermanosActivos.length - hermanosPendientes.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Auditoría: movimiento económico masivo, ya confirmado.
    await AuditService.log(AUDIT_ACTIONS.CUOTAS_GENERAR, meta ?? {}, 'recibo', `year:${year}:${resultado.creados}`, {
      despues: { year, concepto: conceptoLimpio, importe: String(importe), creados: resultado.creados, omitidos: resultado.omitidos }
    });

    if (resultado.creados === 0) {
      return { message: 'Todos los hermanos activos ya tenían su cuota de ese año.', omitidos: resultado.omitidos };
    }
    return {
      message: `Proceso completado. Se generaron ${resultado.creados} recibos nuevos.`,
      omitidos: resultado.omitidos
    };
  }

  /**
   * Emite un recibo suelto a un hermano: una cuota que faltaba, un donativo
   * comprometido o la reemisión de un recibo que el banco devolvió (los
   * devueltos son finales: para volver a cobrar se emite otro).
   */
  static async emitirRecibo(dto: EmitirReciboDto, meta?: AuditMeta) {
    const concepto = dto.concepto.trim();

    const recibo = await transactionWithRetry(async (tx) => {
      const hermano = await tx.hermano.findUnique({
        where: { id: dto.hermanoId },
        select: { id: true, activo: true, formaPagoPref: true }
      });
      if (!hermano || !hermano.activo) throw new NotFoundError('No hay ningún hermano activo con ese identificador.');

      // La clave única es [hermano, año, concepto]. Se comprueba aquí para dar
      // un motivo que se entienda en vez del error genérico de duplicado.
      const repetido = await tx.recibo.findUnique({
        where: { hermanoId_year_concepto: { hermanoId: dto.hermanoId, year: dto.year, concepto } },
        select: { id: true }
      });
      if (repetido) {
        throw new HttpError(`Este hermano ya tiene un recibo «${concepto}» de ${dto.year}. Si es una reemisión, cambia el concepto (por ejemplo, «${concepto} (reemisión)»).`, 409);
      }

      // Una cuota por hermano y año, se llame como se llame: con otro concepto
      // («Cuota 2026» junto a «Cuota anual») la clave única no lo impedía y el
      // hermano pagaba dos veces. Solo cuenta la cuota viva (por cobrar,
      // remesada o cobrada): tras una devuelta o anulada, emitir otra es
      // justo la reemisión que este extremo existe para permitir.
      if (dto.tipo === TipoRecibo.CUOTA_HERMANO) {
        const cuotaViva = await tx.recibo.findFirst({
          where: { hermanoId: dto.hermanoId, year: dto.year, tipo: TipoRecibo.CUOTA_HERMANO, estado: { in: [...ESTADOS_CUOTA_VIVA] } },
          select: { concepto: true, estado: true }
        });
        if (cuotaViva) {
          throw new HttpError(`Este hermano ya tiene su cuota de ${dto.year} («${cuotaViva.concepto}», ${cuotaViva.estado.toLowerCase()}). Solo se emite otra si esa se devuelve o se anula.`, 409);
        }
      }

      return tx.recibo.create({
        data: {
          hermanoId: dto.hermanoId,
          year: dto.year,
          concepto,
          importe: new Prisma.Decimal(dto.importe),
          tipo: dto.tipo as TipoRecibo,
          estado: EstadoPago.PENDIENTE,
          metodoPago: hermano.formaPagoPref === 'DOMICILIACION' ? MetodoPago.DOMICILIACION : undefined
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await AuditService.log(AUDIT_ACTIONS.RECIBO_EMITIR, meta ?? {}, 'recibo', recibo.id, {
      despues: { hermanoId: recibo.hermanoId, year: recibo.year, concepto: recibo.concepto, tipo: recibo.tipo, ...fotoRecibo(recibo) }
    });

    return recibo;
  }

  // =================================================================
  //  2. CONSULTA FAMILIAR (PADRE/TUTOR)
  // =================================================================

  /**
   * Los recibos de toda la familia del usuario, en una sola lista plana.
   *
   * La unidad que se pagina es el RECIBO, que es lo que la pantalla enseña por
   * filas: paginar por miembro dejaba el tamaño de página sin acotar nada —
   * veinte miembros arrastran los cientos de recibos que tengan colgando— y
   * hacía que el paginador dijese «3 resultados» encima de una tabla de treinta
   * filas. Cada recibo trae de quién es para poder nombrarlo en su fila.
   */
  static async getRecibosByUsuarioFamilia(userId: number, query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);
    const where = { hermano: { userId, activo: true } };

    const [data, total] = await db.$transaction([
      db.recibo.findMany({
        where,
        include: {
          // esTitular le vendrá genial al frontend para ponerle una estrellita o algo al gestor
          hermano: { select: { nombre: true, apellidos: true, esTitular: true } }
        },
        orderBy: [
          { year: 'desc' },   // Los dos criterios que antes ordenaban los recibos
          { estado: 'asc' },  // dentro de cada miembro, ahora sobre la lista entera
          { id: 'asc' }       // Desempate: dos recibos del mismo año y estado —la cuota y la
                              // papeleta de dos hijos, por ejemplo— dejarían el orden a merced
                              // de MariaDB y uno saldría en dos páginas y otro en ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.recibo.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  // =================================================================
  //  3. PIEZAS COMPARTIDAS CON LA MESA DE REPARTO (dentro de una transacción)
  // =================================================================

  /**
   * PAGADO -> DEVUELTO con su asiento de reverso, dentro de la transacción de
   * quien llama. Es el único camino para retroceder un cobro: lo usan la
   * edición de Tesorería y la anulación de una papeleta en mesa, que antes
   * pasaba el recibo a ANULADO por su cuenta y dejaba el ingreso en contabilidad
   * como si el dinero siguiera en caja.
   *
   * El cambio va condicionado a que siga PAGADO: de dos peticiones a la vez,
   * solo una gana y solo una apunta el reverso.
   *
   * La categoría del reverso llega ya resuelta (`idCategoriaDevoluciones`,
   * fuera de la transacción): ver `idCategoriaDeRecibos`.
   */
  static async devolverCobroEnTransaccion(
    tx: Tx,
    recibo: { id: number; importe: Prisma.Decimal; metodoPago: MetodoPago | null; hermanoId: number },
    categoriaDevolucionesId: number,
    observaciones?: string
  ) {
    const transicion = await tx.recibo.updateMany({
      where: { id: recibo.id, estado: EstadoPago.PAGADO },
      data: { estado: EstadoPago.DEVUELTO, ...(observaciones !== undefined ? { observaciones } : {}) }
    });
    if (transicion.count !== 1) throw new HttpError(MENSAJE_ESTADO_CAMBIADO, 409);

    // El asiento original debe existir antes de registrar un reverso.
    const ingresoOriginal = await tx.transaccion.findFirst({
      where: { reciboId: recibo.id, tipo: TipoTransaccion.INGRESO }
    });
    if (!ingresoOriginal) {
      throw new HttpError('No se puede devolver el recibo porque no tiene asiento contable de ingreso.', 409);
    }

    const conceptoReverso = `Reverso contable recibo #${recibo.id}`;
    const reversoExistente = await tx.transaccion.findFirst({
      where: { reciboId: recibo.id, tipo: TipoTransaccion.GASTO, concepto: conceptoReverso }
    });
    if (reversoExistente) return;

    await tx.transaccion.create({
      data: {
        tipo: TipoTransaccion.GASTO,
        categoriaId: categoriaDevolucionesId,
        concepto: conceptoReverso,
        importe: recibo.importe,
        fecha: new Date(),
        metodoPago: recibo.metodoPago,
        hermanoId: recibo.hermanoId,
        reciboId: recibo.id
      }
    });
  }

  /**
   * Deja sin efecto la papeleta de un recibo, si la tiene: libera la cita (por
   * si el hermano quiere volver otro día) y borra la papeleta, que libera su
   * hueco en la procesión y la clave [hermano, año] para una reinscripción.
   * Devuelve la papeleta retirada, o `null` si el recibo no tenía.
   */
  static async retirarPapeletaEnTransaccion(tx: Tx, reciboId: number) {
    const papeleta = await tx.papeletaSitio.findUnique({ where: { reciboId } });
    if (!papeleta) return null;

    if (papeleta.citaId) {
      await tx.cita.updateMany({
        where: { id: papeleta.citaId },
        data: { estado: EstadoCita.CANCELADA }
      });
    }
    await tx.papeletaSitio.delete({ where: { id: papeleta.id } });
    return papeleta;
  }

  /**
   * Id de una categoría contable de los recibos, creándola la primera vez.
   *
   * Se llama FUERA de la transacción del cobro o la devolución. En MariaDB el
   * `upsert` de Prisma no es atómico (lee y luego inserta): la primera vez que
   * dos cobros o dos devoluciones coinciden, los dos ven la categoría ausente,
   * los dos la insertan y el segundo choca con el índice único [tipo, nombre]
   * (P2002, reproducido con seis a la vez). Dentro de una transacción ese
   * choque tumbaba la operación entera con un «ya existe» que no tenía nada
   * que ver con el recibo, y releer ahí dentro no sirve: la lectura
   * consistente de la transacción no ve la fila que el otro acaba de confirmar.
   * Aquí fuera, el que pierde simplemente relee la que ganó.
   */
  static async idCategoriaDeRecibos(tipo: TipoTransaccion, nombre: string): Promise<number> {
    const clave = { tipo_nombre: { tipo, nombre } };
    try {
      const categoria = await db.categoriaTransaccion.upsert({
        where: clave,
        update: {},
        create: { nombre, tipo }
      });
      return categoria.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existente = await db.categoriaTransaccion.findUnique({ where: clave, select: { id: true } });
        if (existente) return existente.id;
      }
      throw e;
    }
  }

  /** Categoría de ingresos de cuotas y papeletas (ver `idCategoriaDeRecibos`). */
  static idCategoriaIngresos() {
    return ReciboService.idCategoriaDeRecibos(TipoTransaccion.INGRESO, CATEGORIA_INGRESOS);
  }

  /** Categoría de los reversos de recibos devueltos (ver `idCategoriaDeRecibos`). */
  static idCategoriaDevoluciones() {
    return ReciboService.idCategoriaDeRecibos(TipoTransaccion.GASTO, CATEGORIA_DEVOLUCIONES);
  }

  // =================================================================
  //  4. GESTIÓN INDIVIDUAL (ADMIN/TESORERO)
  // =================================================================

  // Cobrar y emitir papeleta
  static async adminMarcarComoPagado(reciboId: number, metodoPago?: MetodoPago, meta?: AuditMeta) {
    // Antes de abrir la transacción: ver idCategoriaDeRecibos.
    const categoriaIngresosId = await ReciboService.idCategoriaIngresos();

    const { recibo, antes } = await transactionWithRetry(async (tx) => {
      const actual = await tx.recibo.findUnique({ where: { id: reciboId } });
      if (!actual) throw new NotFoundError('Recibo no encontrado.');
      if (!puedeCobrarse(actual.estado)) {
        const motivos: Partial<Record<EstadoPago, string>> = {
          [EstadoPago.PAGADO]: 'Este recibo ya estaba pagado.',
          [EstadoPago.ANULADO]: 'No se puede cobrar un recibo anulado.',
          [EstadoPago.DEVUELTO]: 'Este recibo fue devuelto: emite un recibo nuevo para volver a cobrarlo.',
          [EstadoPago.EXENTO]: 'No se puede cobrar un recibo exento.'
        };
        throw new HttpError(motivos[actual.estado] ?? 'Este recibo no se puede cobrar.', 409);
      }

      // Un remesado lo cobra el banco: si no se dice otra cosa, se queda con
      // el método que tenía o, en su defecto, domiciliación.
      const metodo = metodoPago
        ?? (actual.estado === EstadoPago.REMESADO ? (actual.metodoPago ?? MetodoPago.DOMICILIACION) : undefined);

      // El cambio condicionado evita que dos cobros concurrentes envíen dos
      // emails o apunten dos ingresos para el mismo recibo.
      const result = await tx.recibo.updateMany({
        where: { id: reciboId, estado: { in: [...ESTADOS_COBRABLES] } },
        data: {
          estado: EstadoPago.PAGADO,
          fechaPago: new Date(),
          ...(metodo ? { metodoPago: metodo } : {})
        }
      });
      if (result.count !== 1) {
        throw new HttpError('El recibo ya no está pendiente de cobro.', 409);
      }

      const updated = await tx.recibo.findUnique({
        where: { id: reciboId },
        include: {
          hermano: {
            include: {
              user: { select: { email: true, nombre: true } }
            }
          }
        }
      });
      if (!updated) throw new NotFoundError('Recibo no encontrado.');

      await tx.transaccion.create({
        data: {
          tipo: TipoTransaccion.INGRESO,
          categoriaId: categoriaIngresosId,
          concepto: updated.concepto,
          importe: updated.importe,
          fecha: updated.fechaPago ?? new Date(),
          metodoPago: updated.metodoPago,
          hermanoId: updated.hermanoId,
          reciboId: updated.id
        }
      });

      return { recibo: updated, antes: actual };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await AuditService.log(AUDIT_ACTIONS.RECIBO_COBRAR, meta ?? {}, 'recibo', reciboId, {
      antes: fotoRecibo(antes),
      despues: fotoRecibo(recibo)
    });

    // La papeleta asociada, si la hay, se busca aparte.
    const papeleta = await db.papeletaSitio.findUnique({
      where: { reciboId }
    });

    if (recibo.hermano.user?.email && papeleta) {
      const datosEmail: DatosPapeleta = {
        year: recibo.year,
        importe: `${Number(recibo.importe).toFixed(2)} €`,
        concepto: recibo.concepto,
        puesto: papeleta.puesto,
        tramo: papeleta.tramo,
        observaciones: papeleta.observaciones,
        // Van impresos en la papeleta que recibe cada hermano: un valor
        // equivocado se envía y ya no se puede corregir. Misma fuente que la
        // inscripción en mesa.
        ...(await ReciboService.leerDatosEvento())
      };

      console.log(`📨 [Cola] Enviando papeleta recibo #${recibo.id} a ${enmascararEmail(recibo.hermano.user.email)}`);

      EmailService.enviarPapeleta(
        recibo.hermano.user.email,
        recibo.hermano.nombre,
        datosEmail
      ).catch(error => {
        console.error(`❌ [Error Email] Fallo al enviar papeleta ID ${recibo.id}:`, error);
      });
    }

    return recibo;
  }

  // Cambiar el estado de un recibo y los datos de su papeleta (puesto, tramo)
  static async adminUpdateDetalles(reciboId: number, data: UpdateReciboDto, meta?: AuditMeta) {
    const tocaPapeleta = data.puesto !== undefined || data.tramo !== undefined || data.observaciones !== undefined;
    // Solo una devolución puede necesitar el reverso; la categoría se resuelve
    // antes de abrir la transacción (ver idCategoriaDeRecibos).
    const categoriaDevolucionesId = data.estado === EstadoPago.DEVUELTO ? await ReciboService.idCategoriaDevoluciones() : null;

    const resultado = await db.$transaction(async (tx) => {
      const actual = await tx.recibo.findUnique({ where: { id: reciboId }, include: { papeleta: true } });
      if (!actual) throw new NotFoundError('Recibo no encontrado.');

      const destino = data.estado as EstadoPago | undefined;
      const cambiaEstado = destino !== undefined && destino !== actual.estado;

      // El grafo de transiciones vive en src/domain/recibo-estados.ts para
      // poder probarlo sin base de datos.
      if (cambiaEstado && !puedeTransicionar(actual.estado, destino)) {
        throw new HttpError(`No se puede cambiar un recibo de ${actual.estado} a ${destino}.`);
      }

      let papeletaRetirada: { id: number } | null = null;

      if (cambiaEstado) {
        if (requiereReverso(actual.estado, destino)) {
          // requiereReverso implica destino DEVUELTO, así que la categoría ya está resuelta.
          if (categoriaDevolucionesId === null) throw new Error('Falta la categoría de devoluciones.');
          await ReciboService.devolverCobroEnTransaccion(tx, actual, categoriaDevolucionesId);
        } else {
          // Condicionado al estado que se validó: si entre la lectura y la
          // escritura alguien lo cobró, esto no pisa el cobro con un ANULADO
          // (dejaría un ingreso apuntado de un recibo anulado).
          const transicion = await tx.recibo.updateMany({
            where: { id: reciboId, estado: actual.estado },
            data: { estado: destino }
          });
          if (transicion.count !== 1) throw new HttpError(MENSAJE_ESTADO_CAMBIADO, 409);
        }

        // Coherencia con la mesa de reparto: un recibo de papeleta devuelto o
        // anulado se lleva por delante su papeleta, como al anularla en mesa.
        if (anulaPapeleta(destino)) {
          papeletaRetirada = await ReciboService.retirarPapeletaEnTransaccion(tx, reciboId);
        }
      }

      if (tocaPapeleta && !papeletaRetirada) {
        await tx.papeletaSitio.updateMany({
          where: { reciboId },
          data: {
            ...(data.puesto !== undefined ? { puesto: data.puesto } : {}),
            ...(data.tramo !== undefined ? { tramo: data.tramo } : {}),
            ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {})
          }
        });
      }

      const fotoPapeleta = (p: { puesto: string; tramo: string | null; observaciones: string | null } | null) =>
        p ? { puesto: p.puesto, tramo: p.tramo, observaciones: p.observaciones } : null;

      return {
        antes: { estado: actual.estado, papeleta: fotoPapeleta(actual.papeleta) },
        despues: {
          estado: cambiaEstado ? destino : actual.estado,
          papeleta: papeletaRetirada || !actual.papeleta
            ? null
            : fotoPapeleta({
                puesto: data.puesto ?? actual.papeleta.puesto,
                tramo: data.tramo !== undefined ? data.tramo : actual.papeleta.tramo,
                observaciones: data.observaciones !== undefined ? data.observaciones : actual.papeleta.observaciones
              }),
          ...(papeletaRetirada ? { papeletaAnulada: papeletaRetirada.id } : {})
        },
        papeletaAnulada: papeletaRetirada !== null
      };
    });

    // Tras confirmar: la auditoría no da fe de cambios que se deshicieron.
    await AuditService.log(AUDIT_ACTIONS.RECIBO_ACTUALIZAR, meta ?? {}, 'recibo', reciboId, {
      antes: resultado.antes,
      despues: resultado.despues
    });

    return {
      message: resultado.papeletaAnulada
        ? 'Recibo actualizado. Su papeleta de sitio ha quedado anulada.'
        : 'Detalles actualizados',
      papeletaAnulada: resultado.papeletaAnulada
    };
  }
}
