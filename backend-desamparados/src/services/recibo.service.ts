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
import { EmitirReciboDto, GenerarCuotasDto, UpdateReciboDto } from '../dtos/recibo.dto.js';
import { EstadoPago, Prisma, MetodoPago, TipoRecibo, TipoTransaccion } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { rehacerAvisoDeCargo } from './aviso-de-cargo.service.js';
import { anulaPapeleta, estadosCobrablesCon, MENSAJE_REMESADO_EN_MANO, puedeCobrarse, puedeTransicionar, requiereReverso } from '../domain/recibo-estados.js';
import { diaMadrid, instanteDelApunte } from '../domain/contabilidad.js';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { agruparImpagos } from '../domain/impagos.js';
import { diaDeHoy } from '../domain/fechas-hermano.js';
import { notaDePerdon } from '../domain/salidas.js';
import { ORDENES_RECIBOS, ordenDe } from '../domain/ordenacion.js';
import {
  ESTADOS_CUOTA_VIVA, MENSAJE_ESTADO_CAMBIADO, apuntarComisionEnTransaccion, conceptoDeReemision, devolverCobroEnTransaccion, devueltosPendientes, fotoRecibo,
  idCategoriaComisiones, idCategoriaDevoluciones, idCategoriaIngresos, exigirSinReemision, reemitidosDe, retirarPapeletaEnTransaccion,
  whereRecibosAdmin, type ConsultaRecibos,
} from './recibos/comunes.js';

export type { ConsultaRecibos };

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
          // Un REMESADO sin remesa (de cuando se podía «enviar al banco» a
          // mano) puede volver a PENDIENTE; con remesa, no: la web lo decide por esto.
          remesaId: true,
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
    const [grupos, devueltosPorResolver] = await Promise.all([
      db.recibo.groupBy({
        by: ['estado'],
        where: whereRecibosAdmin(query, year),
        _count: { _all: true },
        _sum: { importe: true }
      }),
      // Los devueltos que aún piden algo: un devuelto reemitido ya no se debe.
      devueltosPendientes(whereRecibosAdmin(query, year)),
    ]);
    const estados = Object.fromEntries(
      Object.values(EstadoPago).map((e) => [e, { cuenta: 0, total: 0 }])
    ) as Record<EstadoPago, { cuenta: number; total: number }>;
    for (const g of grupos) {
      estados[g.estado] = { cuenta: g._count._all, total: Number(g._sum.importe ?? 0) };
    }
    return { estados, devueltosPorResolver: { cuenta: devueltosPorResolver.total, total: devueltosPorResolver.importe } };
  }

  /**
   * Hermanos activos que deben cuotas (ver domain/impagos.ts). Se agrupa en
   * memoria: son como mucho unos cientos de recibos, y agrupar y ordenar por
   * persona en SQL con Prisma obligaría a dos consultas igual.
   */
  static async impagos(query: { incluirAnioActual?: string; minimo?: string; page?: unknown; limit?: unknown }) {
    const anioActual = Number(diaDeHoy().slice(0, 4));
    const filas = await filasDeImpagos(query.incluirAnioActual === 'true', Number(query.minimo ?? 1));
    const paginacion = sanearPaginacion(query);
    return {
      ...respuestaPaginada(filas.slice(paginacion.skip, paginacion.skip + paginacion.take), filas.length, paginacion),
      anioActual,
    };
  }

  /**
   * La entrada de Tesorería: cómo va el ejercicio y lo que toca hacer. Todo en
   * una petición, para que la pantalla no pinte a trozos.
   *
   * - `emitido`: lo que se pidió cobrar ese año; exentos, anulados y
   *   reembolsados no se deben, así que no cuentan.
   * - `antiguedad`: lo que se debe (por cobrar y devuelto sin reemitir) de ese
   *   año y de los anteriores, año a año: la deuda vieja es la que se pierde.
   * - `porMetodo`: cómo se cobró lo de ese año.
   * - `tareas`: las remesas que el banco ya cargó y nadie ha dado por
   *   cobradas, lo que queda por cobrar en mano y los hermanos con cuotas de
   *   años anteriores sin pagar (los impagos).
   */
  static async panel(year: number = Number(diaDeHoy().slice(0, 4))) {
    const hoy = diaDeHoy();
    const [{ estados }, debidos, metodos, ultimos, remesas, impagados] = await Promise.all([
      ReciboService.getResumenAdmin({}, year),
      db.recibo.findMany({
        where: { year: { lte: year }, estado: { in: [EstadoPago.PENDIENTE, EstadoPago.DEVUELTO] } },
        select: { id: true, year: true, estado: true, importe: true, hermanoId: true },
      }),
      db.recibo.groupBy({
        by: ['metodoPago'], where: { year, estado: EstadoPago.PAGADO }, _count: { _all: true }, _sum: { importe: true },
      }),
      db.recibo.findMany({
        where: { estado: EstadoPago.PAGADO, fechaPago: { not: null } },
        orderBy: [{ fechaPago: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true, year: true, concepto: true, importe: true, fechaPago: true, metodoPago: true,
          hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true } },
        },
      }),
      db.remesa.findMany({
        where: { estado: 'ENVIADA', fechaCobro: { lte: new Date(`${hoy}T00:00:00Z`) } },
        orderBy: { fechaCobro: 'asc' },
        select: { id: true, fechaCobro: true, recibos: { where: { estado: EstadoPago.REMESADO }, select: { importe: true } } },
      }),
      filasDeImpagos(false, 1),
    ]);

    // Un devuelto ya reemitido no se debe dos veces: cuenta su reemisión.
    const reemitidos = await reemitidosDe(debidos.filter((r) => r.estado === EstadoPago.DEVUELTO));
    const deuda = debidos.filter((r) => !reemitidos.has(r.id));
    const porAnio = new Map<number, { cuenta: number; total: number }>();
    for (const r of deuda) {
      const fila = porAnio.get(r.year) ?? { cuenta: 0, total: 0 };
      fila.cuenta += 1; fila.total += Number(r.importe);
      porAnio.set(r.year, fila);
    }
    const pendientes = deuda.filter((r) => r.year === year && r.estado === EstadoPago.PENDIENTE);
    const centimos = (n: number) => Math.round(n * 100) / 100;

    const cuentan = [EstadoPago.PENDIENTE, EstadoPago.REMESADO, EstadoPago.PAGADO, EstadoPago.DEVUELTO] as const;
    return {
      year,
      estados,
      emitido: {
        cuenta: cuentan.reduce((suma, e) => suma + estados[e].cuenta, 0),
        total: centimos(cuentan.reduce((suma, e) => suma + estados[e].total, 0)),
      },
      antiguedad: [...porAnio.entries()].sort(([a], [b]) => b - a).map(([anio, f]) => ({ year: anio, cuenta: f.cuenta, total: centimos(f.total) })),
      porMetodo: metodos
        .map((m) => ({ metodo: m.metodoPago, cuenta: m._count._all, total: Number(m._sum.importe ?? 0) }))
        .sort((a, b) => b.total - a.total),
      ultimosCobros: ultimos.map((r) => ({ ...r, importe: Number(r.importe) })),
      tareas: {
        remesasCargadas: remesas
          .filter((r) => r.recibos.length > 0)
          .map((r) => ({ id: r.id, fechaCobro: diaMadrid(r.fechaCobro), enElBanco: r.recibos.length, total: centimos(r.recibos.reduce((s2, x) => s2 + Number(x.importe), 0)) })),
        porCobrar: { recibos: pendientes.length, hermanos: new Set(pendientes.map((r) => r.hermanoId)).size, total: centimos(pendientes.reduce((s2, r) => s2 + Number(r.importe), 0)) },
        impagos: { hermanos: impagados.length, total: centimos(impagados.reduce((s2, f) => s2 + f.total, 0)) },
      },
    };
  }

  /**
   * Dar por perdida una papeleta de sitio que el banco devolvió y que no se va
   * a cobrar (el hermano se dio de baja, o no va a volver a la mesa). Tesorería
   * no puede reemitir una papeleta, y un devuelto es final: sin esto se quedaba
   * pidiendo algo para siempre. Lo decide el Hermano Mayor, como el perdón de
   * las cuotas, y queda igual: una reemisión que nace exenta, con la nota de
   * quién lo decidió. En Contabilidad no hay nada que apuntar: al devolverse,
   * el ingreso ya se anuló.
   */
  static async darPorPerdida(reciboId: number, motivo: string | undefined, meta?: MetaDeAuditoria) {
    const nota = notaDePerdon(motivo);
    const reemision = await db.$transaction(async (tx) => {
      const r = await tx.recibo.findUnique({ where: { id: reciboId } });
      if (!r) throw new NotFoundError('Recibo no encontrado.');
      if (r.tipo !== TipoRecibo.PAPELETA_SITIO) throw new HttpError('Solo se da por perdida una papeleta de sitio: una cuota se perdona, y lo demás se reemite.', 409);
      if (r.estado !== EstadoPago.DEVUELTO) throw new HttpError('Solo se da por perdida una papeleta que el banco devolvió.', 409);
      await exigirSinReemision(tx, r);
      return tx.recibo.create({
        data: {
          hermanoId: r.hermanoId, year: r.year, tipo: r.tipo, importe: r.importe, estado: EstadoPago.EXENTO, reemisionDeId: r.id,
          concepto: await conceptoDeReemision(tx, r.hermanoId, r.year, r.concepto), observaciones: nota,
        },
      });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.RECIBO_PERDONAR, meta ?? {}, 'recibo', reciboId, {
      despues: { reemision: reemision.id, concepto: reemision.concepto, estado: reemision.estado, motivo: motivo?.trim() || null },
    });
    return { message: 'Papeleta dada por perdida: ya no se pide.', reemisionId: reemision.id };
  }

  /**
   * Lo que se ha hecho con un recibo, de la auditoría: cobrarlo, cambiarle el
   * estado, remesarlo… Con quién lo hizo, que es lo que se pregunta cuando un
   * cobro no cuadra. La emisión no siempre deja línea propia (la generación de
   * cuotas apunta una por tanda): la pantalla la toma de la fecha del recibo.
   */
  static async historial(reciboId: number) {
    const recibo = await db.recibo.findUnique({ where: { id: reciboId }, select: { id: true, observaciones: true } });
    if (!recibo) throw new NotFoundError('Recibo no encontrado.');
    const lineas = await db.auditLog.findMany({
      where: { entityType: 'recibo', entityId: String(reciboId) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
      select: { id: true, action: true, createdAt: true, detalles: true, user: { select: { nombre: true, apellidos: true } } },
    });
    return {
      observaciones: recibo.observaciones,
      historial: lineas.map((l) => {
        const detalles = (l.detalles ?? {}) as { despues?: { estado?: string; metodoPago?: string | null }; nota?: string };
        return {
          id: l.id,
          accion: l.action,
          fecha: l.createdAt,
          quien: l.user ? `${l.user.nombre} ${l.user.apellidos}`.trim() : null,
          estado: detalles.despues?.estado ?? null,
          metodoPago: detalles.despues?.metodoPago ?? null,
          nota: typeof detalles.nota === 'string' ? detalles.nota : null,
        };
      }),
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
      //
      // Con `reemisionDeId` no se mira: el enlace explícito manda, y ya está
      // acotado (un devuelto del mismo año y tipo, sin otra reemisión). Es lo
      // que cierra el devuelto que el relleno de la migración
      // 20261119200000_reemision_de dejó suelto porque su reemisión se emitió
      // a mano sin «(reemisión)»: DEVUELTO es final y Tesorería no puede
      // anularlo (lo contrario de lo que dice el comentario de esa migración),
      // así que se reemite enlazado y se anula la nueva, que sobra.
      if (dto.tipo === TipoRecibo.CUOTA_HERMANO && dto.reemisionDeId === undefined) {
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

  // Cobrar un recibo. `fechaCargo` es el día en que entró el dinero si no es
  // ahora (una remesa que el banco cargó antes del clic): el asiento va a ese
  // día, que es el que cuadra con el extracto.
  static async adminMarcarComoPagado(reciboId: number, metodoPago?: MetodoPago, meta?: MetaDeAuditoria, fechaCargo?: Date) {
    // Antes de abrir la transacción: ver idCategoriaDeRecibos. La categoría
    // depende del tipo del recibo, que no cambia nunca: leerlo aquí fuera es seguro.
    const previo = await db.recibo.findUnique({ where: { id: reciboId }, select: { tipo: true } });
    if (!previo) throw new NotFoundError('Recibo no encontrado.');
    const categoriaIngresosId = await idCategoriaIngresos(previo.tipo);

    const { recibo, antes } = await transactionWithRetry(
      (tx) => cobrarEnTransaccion(tx, reciboId, { metodoPago, fechaCargo, categoriaIngresosId }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await AuditoriaService.log(ACCIONES_AUDITORIA.RECIBO_COBRAR, meta ?? {}, 'recibo', reciboId, {
      antes: fotoRecibo(antes),
      despues: fotoRecibo(recibo)
    });

    return recibo;
  }

  /**
   * Cobrar varios recibos de una vez (la ventana «Registrar cobro»): todos o
   * ninguno, en una transacción. Si uno ya no se puede cobrar (otra persona lo
   * cobró, o se remesó entretanto), no se cobra ninguno y se dice cuál: medio
   * cobro dejaría la caja sin cuadrar con lo que se tiene en la mano. Cada
   * recibo lleva su asiento y su línea en la auditoría, como cobrado de uno en uno.
   */
  static async cobrarVarios(
    { ids, metodoPago, fecha, nota }: { ids: number[]; metodoPago: MetodoPago; fecha?: string; nota?: string },
    meta?: MetaDeAuditoria,
  ) {
    const unicos = [...new Set(ids)];
    if (fecha !== undefined && fecha > diaDeHoy()) throw new HttpError('El día del cobro no puede ser posterior a hoy.');
    const fechaCargo = fecha !== undefined ? instanteDelApunte(fecha) : undefined;
    const notaLimpia = nota?.trim() || undefined;

    const previos = await db.recibo.findMany({
      where: { id: { in: unicos } },
      select: { id: true, tipo: true, concepto: true, hermano: { select: { nombre: true, apellidos: true } } },
    });
    if (previos.length !== unicos.length) throw new NotFoundError('Alguno de los recibos ya no existe: vuelve a cargar la lista.');
    // Las categorías, antes de abrir la transacción (ver idCategoriaDeRecibos): una por tipo.
    const categorias = new Map<TipoRecibo, number>();
    for (const tipo of new Set(previos.map((r) => r.tipo))) categorias.set(tipo, await idCategoriaIngresos(tipo));
    const porId = new Map(previos.map((r) => [r.id, r]));

    const cobrados = await transactionWithRetry(async (tx) => {
      const hechos: Awaited<ReturnType<typeof cobrarEnTransaccion>>[] = [];
      for (const id of unicos) {
        const previo = porId.get(id)!;
        try {
          hechos.push(await cobrarEnTransaccion(tx, id, { metodoPago, fechaCargo, categoriaIngresosId: categorias.get(previo.tipo)!, nota: notaLimpia }));
        } catch (error) {
          // Que se sepa cuál: en una lista de veinte, «ya estaba pagado» no dice nada.
          if (error instanceof HttpError) {
            throw new HttpError(`${previo.concepto} de ${previo.hermano.nombre} ${previo.hermano.apellidos}: ${error.message} No se ha cobrado ninguno.`, error.status);
          }
          throw error;
        }
      }
      return hechos;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    for (const { recibo, antes } of cobrados) {
      await AuditoriaService.log(ACCIONES_AUDITORIA.RECIBO_COBRAR, meta ?? {}, 'recibo', recibo.id, {
        antes: fotoRecibo(antes),
        despues: fotoRecibo(recibo),
        ...(notaLimpia ? { nota: notaLimpia } : {}),
      });
    }

    const total = cobrados.reduce((suma, { recibo }) => suma + Number(recibo.importe), 0);
    return { cobrados: cobrados.length, total: Math.round(total * 100) / 100 };
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

    // Sale de la remesa (anulado, devuelto…): si el aviso del cargo de su
    // cuenta aún no ha salido de la cola, anunciaría un importe que ya no se carga.
    if (resultado.antes.estado === EstadoPago.REMESADO && resultado.despues.estado !== EstadoPago.REMESADO) {
      await rehacerAvisoDeCargo(reciboId);
    }

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

/**
 * Cobra un recibo dentro de la transacción que se le pasa: el estado, el día,
 * la forma de pago y su asiento de ingreso. Lo comparten el cobro de uno y el
 * de varios, para que los dos hagan exactamente lo mismo. La nota del cobro,
 * si la hay, se suma a las observaciones del recibo: no pisa lo que ya dijeran.
 */
async function cobrarEnTransaccion(
  tx: Prisma.TransactionClient,
  reciboId: number,
  { metodoPago, fechaCargo, categoriaIngresosId, nota }: { metodoPago?: MetodoPago; fechaCargo?: Date; categoriaIngresosId: number; nota?: string },
) {
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
  const observaciones = nota ? (actual.observaciones ? `${actual.observaciones}\nAl cobrar: ${nota}` : `Al cobrar: ${nota}`) : undefined;

  // El cambio condicionado evita que dos cobros concurrentes apunten dos
  // ingresos para el mismo recibo, y que se cobre en mano lo que se remesó
  // mientras tanto.
  const result = await tx.recibo.updateMany({
    where: { id: reciboId, estado: { in: estadosCobrablesCon(metodo) } },
    data: {
      estado: EstadoPago.PAGADO,
      fechaPago: fechaCargo ?? new Date(),
      ...(metodo ? { metodoPago: metodo } : {}),
      ...(observaciones ? { observaciones } : {}),
    }
  });
  if (result.count !== 1) {
    throw new HttpError('El recibo ya no está pendiente de cobro.', 409);
  }

  const updated = await tx.recibo.findUnique({ where: { id: reciboId } });
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
}

/**
 * Hermanos activos que deben cuotas (ver domain/impagos.ts), sin paginar: lo
 * comparten el listado de impagos y el resumen de la entrada. Una cuota
 * devuelta y ya reemitida no se debe dos veces: cuenta su reemisión.
 */
async function filasDeImpagos(incluirAnioActual: boolean, minimo: number) {
  const anioActual = Number(diaDeHoy().slice(0, 4));
  const leidos = await db.recibo.findMany({
    where: {
      tipo: TipoRecibo.CUOTA_HERMANO,
      estado: { in: [EstadoPago.PENDIENTE, EstadoPago.DEVUELTO] },
      hermano: { activo: true },
      ...(incluirAnioActual ? {} : { year: { lt: anioActual } }),
    },
    select: {
      id: true, year: true, estado: true, importe: true,
      hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true } },
    },
  });
  const reemitidas = await reemitidosDe(leidos.filter((r) => r.estado === EstadoPago.DEVUELTO));
  return agruparImpagos(leidos.filter((r) => !reemitidas.has(r.id)), minimo);
}
