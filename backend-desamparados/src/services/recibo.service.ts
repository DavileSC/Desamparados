/**
 * Los recibos desde el mostrador de Tesorería: el listado con sus filtros, la
 * generación de la cuota anual, la emisión suelta, el cobro y las correcciones
 * de estado.
 *
 * Lo que el hermano ve de sus propios recibos está en `mis-recibos.service`, y
 * lo que esto comparte con la mesa de reparto —las categorías contables, la
 * devolución de un cobro y la retirada de una papeleta— en `recibos/comunes`.
 */
import db from '../config/db';
import { EmailService } from './email.service';
import { EmitirReciboDto, GenerarCuotasDto, UpdateReciboDto } from '../dtos/recibo.dto.js';
import { EstadoCita, EstadoPago, Prisma, MetodoPago, TipoRecibo, TipoTransaccion } from '@prisma/client';
import { DatosPapeleta } from '../dtos/email.dto.js';
import { articuloDe } from '../domain/articulos.js';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { anulaPapeleta, estadosCobrablesCon, MENSAJE_REMESADO_EN_MANO, puedeCobrarse, puedeTransicionar, requiereReverso } from '../domain/recibo-estados.js';
import { diaMadrid, instanteDelApunte } from '../domain/contabilidad.js';
import { enmascararEmail } from '../utils/log-privacidad.js';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { agruparImpagos } from '../domain/impagos.js';
import { diaDeHoy } from '../domain/fechas-hermano.js';
import { ORDENES_RECIBOS, ordenDe } from '../domain/ordenacion.js';
import {
  ESTADOS_CUOTA_VIVA, MENSAJE_ESTADO_CAMBIADO, apuntarComisionEnTransaccion, devolverCobroEnTransaccion, fotoRecibo,
  idCategoriaComisiones, idCategoriaDevoluciones, idCategoriaIngresos, exigirSinReemision, leerDatosEvento, reemitidosDe, retirarPapeletaEnTransaccion,
  whereRecibosAdmin, type ConsultaRecibos,
} from './recibos/comunes.js';

export type { ConsultaRecibos };

type Tx = Prisma.TransactionClient;

export class ReciboService {

  static async getAdminRecibos(query: ConsultaRecibos = {}, year?: number, estado?: EstadoPago) {
    const paginacion = sanearPaginacion(query);
    const where = whereRecibosAdmin(query, year, estado);

    const [data, total] = await db.$transaction([
      db.recibo.findMany({
        where,
        // El desempate por id importa aquí más que en ningún sitio: los recibos
        // emitidos de una tacada comparten `createdAt` (MariaDB evalúa DEFAULT
        // CURRENT_TIMESTAMP una vez por sentencia). Ver domain/ordenacion.ts.
        orderBy: ordenDe(ORDENES_RECIBOS, query.orden),
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

    // Un devuelto ya reemitido no pide nada: la pantalla deja de ofrecer reemitirlo.
    const reemitidos = await reemitidosDe(data.filter((r) => r.estado === EstadoPago.DEVUELTO));
    return respuestaPaginada(data.map((r) => ({ ...r, reemitido: reemitidos.has(r.id) })), total, paginacion);
  }

  /**
   * Cuántos recibos hay en cada estado, y cuánto suman, con la misma búsqueda,
   * año y tipo que el listado pero sin filtrar por estado: son los contadores
   * de encima del listado, que a la vez sirven para elegir el estado. Salen
   * todos los estados, también con cero, para que la pantalla no tenga que
   * adivinar los que faltan.
   */
  static async getResumenAdmin(query: ConsultaRecibos = {}, year?: number) {
    const grupos = await db.recibo.groupBy({
      by: ['estado'],
      where: whereRecibosAdmin(query, year),
      _count: { _all: true },
      _sum: { importe: true }
    });
    const estados = Object.fromEntries(
      Object.values(EstadoPago).map((e) => [e, { cuenta: 0, total: 0 }])
    ) as Record<EstadoPago, { cuenta: number; total: number }>;
    for (const g of grupos) {
      estados[g.estado] = { cuenta: g._count._all, total: Number(g._sum.importe ?? 0) };
    }
    return { estados };
  }

  /**
   * Hermanos activos que deben cuotas (ver domain/impagos.ts). Se agrupa en
   * memoria: son como mucho unos cientos de recibos, y agrupar y ordenar por
   * persona en SQL con Prisma obligaría a dos consultas igual.
   */
  static async impagos(query: { incluirAnioActual?: string; minimo?: string; page?: unknown; limit?: unknown }) {
    const anioActual = Number(diaDeHoy().slice(0, 4));
    const leidos = await db.recibo.findMany({
      where: {
        tipo: TipoRecibo.CUOTA_HERMANO,
        estado: { in: [EstadoPago.PENDIENTE, EstadoPago.DEVUELTO] },
        hermano: { activo: true },
        ...(query.incluirAnioActual === 'true' ? {} : { year: { lt: anioActual } }),
      },
      select: {
        id: true, year: true, estado: true, importe: true,
        hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true } },
      },
    });
    // Una cuota devuelta y ya reemitida no se debe dos veces: cuenta su reemisión.
    const reemitidas = await reemitidosDe(leidos.filter((r) => r.estado === EstadoPago.DEVUELTO));
    const recibos = leidos.filter((r) => !reemitidas.has(r.id));
    const filas = agruparImpagos(recibos, Number(query.minimo ?? 1));
    const paginacion = sanearPaginacion(query);
    return {
      ...respuestaPaginada(filas.slice(paginacion.skip, paginacion.skip + paginacion.take), filas.length, paginacion),
      anioActual,
    };
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

  static async generarCuotaAnual({ year, importe, concepto }: GenerarCuotasDto, meta?: MetaDeAuditoria) {
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
    await AuditoriaService.log(ACCIONES_AUDITORIA.CUOTAS_GENERAR, meta ?? {}, 'recibo', `year:${year}:${resultado.creados}`, {
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
  static async emitirRecibo(dto: EmitirReciboDto, meta?: MetaDeAuditoria) {
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

      // Una cuota nueva con la de ese año devuelta y sin reemitir es su
      // reemisión aunque no se diga: solo hay una cuota por año, y si no se
      // enlazara la deuda contaría dos veces.
      let reemisionDeId = dto.reemisionDeId;
      if (reemisionDeId === undefined && dto.tipo === TipoRecibo.CUOTA_HERMANO) {
        const devuelta = await tx.recibo.findFirst({
          where: { hermanoId: dto.hermanoId, year: dto.year, tipo: TipoRecibo.CUOTA_HERMANO, estado: EstadoPago.DEVUELTO, reemision: { is: null } },
          orderBy: { id: 'desc' },
          select: { id: true },
        });
        reemisionDeId = devuelta?.id;
      }

      // Una reemisión es del mismo hermano, año y tipo que su devuelto, y
      // solo una por devuelto (exigirSinReemision).
      if (reemisionDeId !== undefined) {
        const devuelto = await tx.recibo.findUnique({ where: { id: reemisionDeId } });
        if (!devuelto || devuelto.hermanoId !== dto.hermanoId) throw new NotFoundError('No se encontró el recibo devuelto que se quiere reemitir.');
        if (devuelto.estado !== EstadoPago.DEVUELTO) throw new HttpError(`«${devuelto.concepto}» no está devuelto: solo se reemite un recibo devuelto.`, 409);
        if (devuelto.year !== dto.year || devuelto.tipo !== dto.tipo) {
          throw new HttpError(`La reemisión de «${devuelto.concepto}» tiene que ser del mismo año y tipo que él.`, 400);
        }
        await exigirSinReemision(tx, devuelto);
      }

      return tx.recibo.create({
        data: {
          hermanoId: dto.hermanoId,
          year: dto.year,
          reemisionDeId: reemisionDeId ?? null,
          concepto,
          importe: new Prisma.Decimal(dto.importe),
          tipo: dto.tipo as TipoRecibo,
          estado: EstadoPago.PENDIENTE,
          metodoPago: hermano.formaPagoPref === 'DOMICILIACION' ? MetodoPago.DOMICILIACION : undefined
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await AuditoriaService.log(ACCIONES_AUDITORIA.RECIBO_EMITIR, meta ?? {}, 'recibo', recibo.id, {
      despues: { hermanoId: recibo.hermanoId, year: recibo.year, concepto: recibo.concepto, tipo: recibo.tipo, reemisionDeId: recibo.reemisionDeId, ...fotoRecibo(recibo) }
    });

    return recibo;
  }

  // =================================================================
  //  2. CONSULTA FAMILIAR (PADRE/TUTOR)
  // =================================================================

  // =================================================================
  //  4. GESTIÓN INDIVIDUAL (ADMIN/TESORERO)
  // =================================================================

  // Cobrar y emitir papeleta. `fechaCargo` es el día en que entró el dinero si
  // no es ahora (una remesa que el banco cargó antes del clic): el asiento va a
  // ese día, que es el que cuadra con el extracto.
  static async adminMarcarComoPagado(reciboId: number, metodoPago?: MetodoPago, meta?: MetaDeAuditoria, fechaCargo?: Date) {
    // Antes de abrir la transacción: ver idCategoriaDeRecibos. La categoría
    // depende del tipo del recibo, que no cambia nunca: leerlo aquí fuera es seguro.
    const previo = await db.recibo.findUnique({ where: { id: reciboId }, select: { tipo: true } });
    if (!previo) throw new NotFoundError('Recibo no encontrado.');
    const categoriaIngresosId = await idCategoriaIngresos(previo.tipo);

    const { recibo, antes } = await transactionWithRetry(async (tx) => {
      const actual = await tx.recibo.findUnique({ where: { id: reciboId } });
      if (!actual) throw new NotFoundError('Recibo no encontrado.');
      if (!puedeCobrarse(actual.estado)) {
        const motivos: Partial<Record<EstadoPago, string>> = {
          [EstadoPago.PAGADO]: 'Este recibo ya estaba pagado.',
          [EstadoPago.ANULADO]: 'No se puede cobrar un recibo anulado.',
          [EstadoPago.DEVUELTO]: 'Este recibo fue devuelto: emite un recibo nuevo para volver a cobrarlo.',
          [EstadoPago.REEMBOLSADO]: 'Este recibo se reembolsó: no se vuelve a cobrar.',
          [EstadoPago.EXENTO]: 'No se puede cobrar un recibo exento.'
        };
        throw new HttpError(motivos[actual.estado] ?? 'Este recibo no se puede cobrar.', 409);
      }

      // Un remesado lo cobra el banco, y solo por domiciliación (ver estadosCobrablesCon).
      if (actual.estado === EstadoPago.REMESADO && !estadosCobrablesCon(metodoPago).includes(EstadoPago.REMESADO)) {
        throw new HttpError(`Este recibo ${MENSAJE_REMESADO_EN_MANO}`, 409);
      }
      const metodo = metodoPago ?? (actual.estado === EstadoPago.REMESADO ? MetodoPago.DOMICILIACION : undefined);

      // El cambio condicionado evita que dos cobros concurrentes envíen dos
      // emails o apunten dos ingresos para el mismo recibo, y que se cobre en
      // mano lo que se remesó mientras tanto.
      const result = await tx.recibo.updateMany({
        where: { id: reciboId, estado: { in: estadosCobrablesCon(metodo) } },
        data: {
          estado: EstadoPago.PAGADO,
          fechaPago: fechaCargo ?? new Date(),
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

    await AuditoriaService.log(ACCIONES_AUDITORIA.RECIBO_COBRAR, meta ?? {}, 'recibo', reciboId, {
      antes: fotoRecibo(antes),
      despues: fotoRecibo(recibo)
    });

    // La papeleta asociada, si la hay, se busca aparte.
    const papeleta = await db.papeletaSitio.findUnique({
      where: { reciboId },
      include: { salida: { include: { acto: true } } },
    });

    if (recibo.hermano.user?.email && papeleta) {
      const datosEmail: DatosPapeleta = {
        year: recibo.year,
        salida: { nombre: papeleta.salida.nombre, cobro: papeleta.salida.cobro, conRopa: papeleta.salida.conRopa, indicaciones: papeleta.salida.indicaciones, articulo: articuloDe(papeleta.salida) },
        importe: `${Number(recibo.importe).toFixed(2)} €`,
        concepto: recibo.concepto,
        papeletaId: papeleta.id,
        puesto: papeleta.puesto,
        tramo: papeleta.tramo,
        tunica: papeleta.numTunicaAsignada,
        observaciones: papeleta.observaciones,
        // Van impresos en la papeleta que recibe cada hermano: un valor
        // equivocado se envía y ya no se puede corregir. Misma fuente que la
        // inscripción en mesa.
        ...leerDatosEvento(papeleta.salida, papeleta.year)
      };

      console.log(`📨 [Cola] Enviando papeleta recibo #${recibo.id} a ${enmascararEmail(recibo.hermano.user.email)}`);

      EmailService.enviarPapeleta(
        recibo.hermano.user.email,
        recibo.hermano.nombre,
        datosEmail,
        recibo.hermano.sexo
      ).catch(error => {
        console.error(`❌ [Error Email] Fallo al enviar papeleta ID ${recibo.id}:`, error);
      });
    }

    return recibo;
  }

  // Cambiar el estado de un recibo y los datos de su papeleta (puesto, tramo)
  // `delExtracto`: la devolución la trae un extracto Norma 43 (ver más abajo).
  static async adminUpdateDetalles(reciboId: number, data: UpdateReciboDto, meta?: MetaDeAuditoria, { delExtracto = false } = {}) {
    const tocaPapeleta = data.puesto !== undefined || data.tramo !== undefined || data.observaciones !== undefined;
    // Solo una devolución puede necesitar el reverso; la categoría se resuelve
    // antes de abrir la transacción (ver idCategoriaDeRecibos).
    const retrocede = data.estado === EstadoPago.DEVUELTO || data.estado === EstadoPago.REEMBOLSADO;
    const categoriaDevolucionesId = retrocede ? await idCategoriaDevoluciones() : null;
    // La comisión del banco y el día de la devolución solo tienen sentido al devolver.
    if (data.comision !== undefined && data.estado !== EstadoPago.DEVUELTO) {
      throw new HttpError('La comisión del banco solo se apunta al devolver un recibo.');
    }
    if (data.fechaDevolucion !== undefined && data.estado !== EstadoPago.DEVUELTO) {
      throw new HttpError('El día de la devolución solo se indica al devolver un recibo.');
    }
    if (data.fechaDevolucion !== undefined && data.fechaDevolucion > diaDeHoy()) {
      throw new HttpError('El día de la devolución no puede ser posterior a hoy.');
    }
    // Los asientos de la devolución, al día en que el banco la hizo (ver devolverCobroEnTransaccion).
    const fechaDevolucion = data.fechaDevolucion !== undefined ? instanteDelApunte(data.fechaDevolucion) : new Date();
    const categoriaComisionesId = data.comision !== undefined ? await idCategoriaComisiones() : null;

    const resultado = await db.$transaction(async (tx) => {
      const actual = await tx.recibo.findUnique({ where: { id: reciboId }, include: { papeleta: true } });
      if (!actual) throw new NotFoundError('Recibo no encontrado.');

      const destino = data.estado as EstadoPago | undefined;
      const cambiaEstado = destino !== undefined && destino !== actual.estado;

      // El grafo de transiciones vive en src/domain/recibo-estados.ts para
      // poder probarlo sin base de datos.
      if (cambiaEstado && !puedeTransicionar(actual.estado, destino, actual)) {
        throw new HttpError(`No se puede cambiar un recibo de ${actual.estado} a ${destino}.`);
      }
      // El día de la devolución no puede ser anterior al ingreso: el reverso
      // caería en otro ejercicio sin nada que deshacer (un año mal puesto).
      // El de un extracto es el del banco y no es un error: si la remesa se
      // dio por cobrada a mano días después, el reverso va al día del cobro.
      let fechaReverso = fechaDevolucion;
      if (cambiaEstado && data.fechaDevolucion !== undefined && requiereReverso(actual.estado, destino)) {
        const ingreso = await tx.transaccion.findFirst({ where: { reciboId, tipo: TipoTransaccion.INGRESO }, orderBy: { fecha: 'asc' }, select: { fecha: true } });
        const diaDelCobro = ingreso ? diaMadrid(ingreso.fecha) : actual.fechaPago ? diaMadrid(actual.fechaPago) : null;
        if (diaDelCobro !== null && data.fechaDevolucion < diaDelCobro) {
          if (!delExtracto) throw new HttpError(`El día de la devolución no puede ser anterior al del cobro (${diaDelCobro.split('-').reverse().join('/')}).`);
          fechaReverso = instanteDelApunte(diaDelCobro);
        }
      }
      // Un recibo que ya estaba devuelto no genera otra comisión.
      if (data.comision !== undefined && !cambiaEstado) {
        throw new HttpError('Este recibo ya estaba devuelto: su comisión se apuntó entonces.', 409);
      }

      let papeletaRetirada: { id: number } | null = null;

      if (cambiaEstado) {
        if (requiereReverso(actual.estado, destino)) {
          // requiereReverso implica destino DEVUELTO o REEMBOLSADO, así que la categoría ya está resuelta.
          if (categoriaDevolucionesId === null) throw new Error('Falta la categoría de devoluciones.');
          await devolverCobroEnTransaccion(tx, actual, categoriaDevolucionesId, {
            destino: destino as typeof EstadoPago.DEVUELTO | typeof EstadoPago.REEMBOLSADO,
            fecha: fechaReverso,
          });
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

        if (categoriaComisionesId !== null && data.comision !== undefined) {
          await apuntarComisionEnTransaccion(tx, actual, data.comision, categoriaComisionesId, fechaReverso);
        }

        // Coherencia con la mesa de reparto: un recibo de papeleta devuelto o
        // anulado se lleva por delante su papeleta, como al anularla en mesa.
        if (anulaPapeleta(destino)) {
          papeletaRetirada = await retirarPapeletaEnTransaccion(tx, reciboId);
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
          ...(cambiaEstado && data.comision !== undefined ? { comision: data.comision } : {}),
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
    await AuditoriaService.log(ACCIONES_AUDITORIA.RECIBO_ACTUALIZAR, meta ?? {}, 'recibo', reciboId, {
      antes: resultado.antes,
      despues: resultado.despues
    });

    // Lo que ha pasado en Contabilidad, dicho en el aviso: desde allí no se ve el porqué.
    const enContabilidad = [
      (resultado.despues.estado === EstadoPago.DEVUELTO || resultado.despues.estado === EstadoPago.REEMBOLSADO) && resultado.antes.estado === EstadoPago.PAGADO ? 'el cobro queda anulado en Contabilidad' : null,
      'comision' in resultado.despues ? 'la comisión del banco queda apuntada' : null,
    ].filter(Boolean).join(' y ');
    return {
      message: [
        'Recibo actualizado.',
        enContabilidad ? `${enContabilidad[0].toUpperCase()}${enContabilidad.slice(1)}.` : null,
        resultado.papeletaAnulada ? 'Su papeleta de sitio ha quedado anulada.' : null,
      ].filter(Boolean).join(' '),
      papeletaAnulada: resultado.papeletaAnulada
    };
  }
}
