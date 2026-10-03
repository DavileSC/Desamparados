import { EstadoPago, Prisma, type Transaccion, type TipoTransaccion } from '@prisma/client';
import db from '../config/db.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { MetaDeAuditoria, AuditoriaService, ACCIONES_AUDITORIA } from './auditoria.service.js';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { ORDENES_LIBRO, ordenDe } from '../domain/ordenacion.js';
import {
  agruparEnSerie,
  claveNombreCategoria,
  diaMadrid,
  esCategoriaDeRecibos,
  fechasInvertidas,
  granularidad,
  inicioDiaMadrid,
  instanteDelApunte,
  leerFiltros,
  limpiarNombreCategoria,
  motivoFechaApunte,
  motivoImporteInvalido,
  periodoAnterior,
  whereContable,
  type FiltrosContables,
} from '../domain/contabilidad.js';
import type { CreateTransaccionDto, UpdateTransaccionDto } from '../dtos/transaccion.dto.js';
import { devueltosPendientes } from './recibos/comunes.js';

const deTipo = (tipo: TipoTransaccion) => (tipo === 'INGRESO' ? 'ingreso' : 'gasto');

export const TRANSACCION_ERRORS = {
  NO_EXISTE: 'El apunte no existe.',
  // Los de recibos se corrigen desde el recibo: tocarlos aquí descuadraría la
  // contabilidad con el estado del recibo (cobrado, devuelto…).
  DE_RECIBO: 'Este apunte viene de un recibo y se corrige desde el recibo, en Tesorería.',
  // Igual con la lotería: el talonario daría por liquidado lo que ya no está apuntado.
  DE_LOTERIA: 'Este apunte viene de la lotería y se corrige desde Lotería (la compra o la liquidación del talonario).',
  DE_CAJA: 'Este apunte es una venta en mano de la tienda: se anula desde Tienda → «Venta en mano».',
  CATEGORIA_NO_EXISTE: 'La categoría no existe.',
  FECHAS_AL_REVES: 'La fecha «hasta» no puede ser anterior a la fecha «desde».',
} as const;

/**
 * Lo que guarda la auditoría de un apunte: lo justo para saber qué había y qué
 * quedó sin reconstruirlo. El importe va como número: el Decimal de Prisma no
 * se guarda en un campo JSON.
 */
function foto(t: Transaccion) {
  return {
    tipo: t.tipo,
    categoriaId: t.categoriaId,
    concepto: t.concepto,
    importe: Number(t.importe),
    fecha: t.fecha.toISOString(),
    metodoPago: t.metodoPago,
  };
}

/** El servicio también se llama sin pasar por la ruta: un periodo al revés es un 400 aquí igual que en el esquema. */
function exigirFechasEnOrden(filtros: FiltrosContables) {
  if (fechasInvertidas(filtros)) throw new HttpError(TRANSACCION_ERRORS.FECHAS_AL_REVES);
}

/** La misma comprobación que el esquema, repetida por si el servicio se usa desde otro sitio. */
function exigirApunteValido(data: { importe: number; fecha: string }, ahora: Date) {
  const motivoImporte = motivoImporteInvalido(data.importe);
  if (motivoImporte) throw new HttpError(`El importe ${motivoImporte}.`);
  const motivoFecha = motivoFechaApunte(data.fecha, ahora);
  if (motivoFecha) throw new HttpError(`La fecha ${motivoFecha}.`);
}

export class TransaccionService {

  // ==========================================
  //  GESTIÓN DE CATEGORÍAS (Para los Ajustes)
  // ==========================================

  /**
   * Por defecto solo las activas, que son las que se ofrecen al apuntar. `todas`
   * trae también las desactivadas. `deRecibos` marca las que usan los recibos,
   * para que la pantalla no ofrezca renombrarlas.
   *
   * `usoAnio`: apuntes e importe de cada una en el año natural en curso (en
   * Madrid), también cero. Es lo que enseña la gestión de categorías para
   * saber cuáles se usan antes de desactivar o renombrar; el resumen no sirve,
   * porque va con los filtros de la pantalla y se salta las que no tienen apuntes.
   */
  static async getCategorias(tipo?: TipoTransaccion, todas = false, ahora = new Date()) {
    const inicioAnio = inicioDiaMadrid(`${diaMadrid(ahora).slice(0, 4)}-01-01`);
    const [categorias, uso] = await Promise.all([
      db.categoriaTransaccion.findMany({
        where: {
          ...(todas ? {} : { activa: true }),
          ...(tipo && { tipo }) // Si me piden solo las de ingreso, filtro
        },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }]
      }),
      db.transaccion.groupBy({
        by: ['categoriaId'],
        where: { fecha: { gte: inicioAnio }, ...(tipo && { tipo }) },
        _count: { _all: true },
        _sum: { importe: true }
      })
    ]);
    const porCategoria = new Map(uso.map((u) => [u.categoriaId, { apuntes: u._count._all, importe: Number(u._sum.importe ?? 0) }]));
    return categorias.map((c) => ({
      ...c,
      deRecibos: esCategoriaDeRecibos(c),
      usoAnio: porCategoria.get(c.id) ?? { apuntes: 0, importe: 0 }
    }));
  }

  /**
   * 409 si ya hay otra categoría del mismo tipo que se llame igual para el índice
   * único de la base (sin mayúsculas, tildes ni ñ: ver claveNombreCategoria). Se
   * comprueba aquí antes de escribir para dar un mensaje que diga con cuál choca
   * y si está desactivada; el índice solo cubre la carrera entre dos altas.
   *
   * Es de uso interno, pero no va como `private`: la prueba de esa carrera
   * necesita saltárselo una vez para provocar el P2002 a propósito, y con
   * `private` solo se alcanzaba con un `as unknown as` que el compilador no
   * mira. Así, si se renombra o se mueve, la prueba deja de compilar en vez de
   * dejar de probar en silencio.
   */
  static async exigirNombreLibre(nombre: string, tipo: TipoTransaccion, salvoId?: number) {
    const delMismoTipo = await db.categoriaTransaccion.findMany({ where: { tipo }, select: { id: true, nombre: true, activa: true } });
    const clave = claveNombreCategoria(nombre);
    const choque = delMismoTipo.find((c) => c.id !== salvoId && claveNombreCategoria(c.nombre) === clave);
    if (!choque) return;
    throw new HttpError(
      choque.activa
        ? `Ya hay una categoría de ${deTipo(tipo)} llamada «${choque.nombre}».`
        : `Ya hay una categoría de ${deTipo(tipo)} llamada «${choque.nombre}», desactivada: reactívala en vez de crear otra.`,
      409,
    );
  }

  /**
   * Escribe un nombre de categoría. Si otra alta con el mismo nombre se ha
   * colado entre la comprobación y la escritura, el índice único responde
   * P2002: se traduce al mismo 409 de exigirNombreLibre, que ahora ya ve la
   * otra y dice con cuál choca. Si ni así la encuentra (alguna equivalencia de
   * la intercalación que la clave no imita), 409 con el nombre pedido.
   */
  private static async conNombreLibre<T>(nombre: string, tipo: TipoTransaccion, salvoId: number | undefined, escribir: () => Promise<T>): Promise<T> {
    try {
      return await escribir();
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      await this.exigirNombreLibre(nombre, tipo, salvoId);
      throw new HttpError(`Ya hay una categoría de ${deTipo(tipo)} llamada «${nombre}».`, 409);
    }
  }

  static async createCategoria(nombre: string, tipo: TipoTransaccion, meta?: MetaDeAuditoria) {
    const limpio = limpiarNombreCategoria(nombre);
    await this.exigirNombreLibre(limpio, tipo);
    const result = await this.conNombreLibre(limpio, tipo, undefined, () => db.categoriaTransaccion.create({
      data: { nombre: limpio, tipo }
    }));
    AuditoriaService.log(ACCIONES_AUDITORIA.CATEGORIA_CREAR, meta ?? {}, 'categoria', result.id, { despues: { nombre: result.nombre, tipo: result.tipo } });
    return result;
  }

  static async renombrarCategoria(id: number, nombre: string, meta?: MetaDeAuditoria) {
    const antes = await db.categoriaTransaccion.findUnique({ where: { id } });
    if (!antes) throw new NotFoundError(TRANSACCION_ERRORS.CATEGORIA_NO_EXISTE);
    if (esCategoriaDeRecibos(antes)) {
      throw new HttpError(`«${antes.nombre}» la usan los recibos al cobrarse o devolverse y no se puede renombrar: el siguiente cobro crearía otra con el nombre de siempre.`, 409);
    }
    const limpio = limpiarNombreCategoria(nombre);
    if (limpio === antes.nombre) return antes;
    await this.exigirNombreLibre(limpio, antes.tipo, id);

    const despues = await this.conNombreLibre(limpio, antes.tipo, id, () => db.categoriaTransaccion.update({ where: { id }, data: { nombre: limpio } }));
    AuditoriaService.log(ACCIONES_AUDITORIA.CATEGORIA_RENOMBRAR, meta ?? {}, 'categoria', id, { antes: { nombre: antes.nombre }, despues: { nombre: despues.nombre } });
    return despues;
  }

  /**
   * Desactivar no borra nada: la categoría deja de salir al apuntar, pero sus
   * apuntes siguen en el libro con su nombre. Reactivar la devuelve al desplegable.
   */
  static async cambiarEstadoCategoria(id: number, activa: boolean, meta?: MetaDeAuditoria) {
    const antes = await db.categoriaTransaccion.findUnique({ where: { id } });
    if (!antes) throw new NotFoundError(TRANSACCION_ERRORS.CATEGORIA_NO_EXISTE);
    if (antes.activa === activa) return antes;
    // Reactivar no escribe el nombre, así que el índice único (tipo, nombre) no
    // puede saltar aquí: no hay P2002 que traducir.
    if (activa) {
      // El índice no junta los espacios de dentro («Flores  y exorno» y «Flores y
      // exorno» caben los dos) y la clave sí: reactivar uno junto a su gemelo
      // activo volvería a enseñar dos iguales en el desplegable.
      const clave = claveNombreCategoria(antes.nombre);
      const gemela = (await db.categoriaTransaccion.findMany({ where: { tipo: antes.tipo, activa: true, id: { not: id } }, select: { nombre: true } }))
        .find((c) => claveNombreCategoria(c.nombre) === clave);
      if (gemela) throw new HttpError(`Ya hay una categoría activa llamada «${gemela.nombre}»: renombra esta antes de reactivarla.`, 409);
    }

    const despues = await db.categoriaTransaccion.update({ where: { id }, data: { activa } });
    AuditoriaService.log(
      activa ? ACCIONES_AUDITORIA.CATEGORIA_REACTIVAR : ACCIONES_AUDITORIA.CATEGORIA_DESACTIVAR,
      meta ?? {},
      'categoria',
      id,
      { antes: { activa: antes.activa }, despues: { activa: despues.activa } },
    );
    return despues;
  }

  // ==========================================
  //  LIBRO MAYOR (Actualizado)
  // ==========================================

  /**
   * La categoría de un apunte: que exista, que sea de su tipo y que esté activa.
   * Al corregir un apunte se le deja conservar la que ya tenía aunque se haya
   * desactivado después: corregir el importe no obliga a recategorizarlo.
   */
  private static async exigirCategoria(categoriaId: number, tipo: TipoTransaccion, yaLaTenia = false) {
    const categoria = await db.categoriaTransaccion.findUnique({ where: { id: categoriaId } });
    if (!categoria) throw new HttpError('La categoría seleccionada no existe.');
    if (categoria.tipo !== tipo) {
      throw new HttpError(`La categoría «${categoria.nombre}» es de ${deTipo(categoria.tipo)} y el apunte es un ${deTipo(tipo)}.`);
    }
    if (!categoria.activa && !yaLaTenia) {
      throw new HttpError(`La categoría «${categoria.nombre}» está desactivada: reactívala o elige otra.`);
    }
    return categoria;
  }

  static async create(data: CreateTransaccionDto, meta?: MetaDeAuditoria) {
    const ahora = new Date();
    const dia = data.fecha ?? diaMadrid(ahora);
    exigirApunteValido({ importe: data.importe, fecha: dia }, ahora);
    await this.exigirCategoria(data.categoriaId, data.tipo);

    const result = await db.transaccion.create({
      data: {
        tipo: data.tipo,
        categoriaId: data.categoriaId,
        concepto: data.concepto.trim(),
        importe: data.importe,
        fecha: instanteDelApunte(dia, ahora),
        metodoPago: data.metodoPago
      }
    });
    AuditoriaService.log(ACCIONES_AUDITORIA.TRANSACCION_CREAR, meta ?? {}, 'transaccion', result.id, { despues: foto(result) });
    return result;
  }

  /** Un apunte manual (sin recibo), o el motivo por el que no se puede tocar. */
  private static async apunteManual(id: number) {
    const encontrado = await db.transaccion.findUnique({ where: { id }, include: { talonarioLoteria: { select: { id: true } }, compraDeLoteria: { select: { id: true } }, ventaDeCaja: { select: { id: true } } } });
    if (!encontrado) throw new NotFoundError(TRANSACCION_ERRORS.NO_EXISTE);
    const { talonarioLoteria, compraDeLoteria, ventaDeCaja, ...apunte } = encontrado;
    if (apunte.reciboId !== null) throw new HttpError(TRANSACCION_ERRORS.DE_RECIBO, 409);
    if (talonarioLoteria || compraDeLoteria) throw new HttpError(TRANSACCION_ERRORS.DE_LOTERIA, 409);
    if (ventaDeCaja) throw new HttpError(TRANSACCION_ERRORS.DE_CAJA, 409);
    return apunte;
  }

  /**
   * Corrige un apunte manual. Antes solo se podía compensar con un contraapunte,
   * que dejaba inflados a la vez los ingresos y los gastos del periodo.
   */
  static async update(id: number, data: UpdateTransaccionDto, meta?: MetaDeAuditoria) {
    const antes = await this.apunteManual(id);
    const ahora = new Date();
    exigirApunteValido(data, ahora);
    await this.exigirCategoria(data.categoriaId, data.tipo, data.categoriaId === antes.categoriaId);

    // Si sigue en el mismo día conserva su hora: corregir el importe no debe
    // moverlo de sitio en el libro.
    const fecha = data.fecha === diaMadrid(antes.fecha) ? antes.fecha : instanteDelApunte(data.fecha, ahora);
    // `reciboId: null` también al escribir: la comprobación de arriba y esta
    // escritura no son atómicas, y un apunte de recibo no se toca nunca desde aquí.
    const despues = await db.transaccion.update({
      where: { id, reciboId: null },
      data: {
        tipo: data.tipo,
        categoriaId: data.categoriaId,
        concepto: data.concepto.trim(),
        importe: data.importe,
        fecha,
        metodoPago: data.metodoPago,
      },
    });
    AuditoriaService.log(ACCIONES_AUDITORIA.TRANSACCION_ACTUALIZAR, meta ?? {}, 'transaccion', id, { antes: foto(antes), despues: foto(despues) });
    return despues;
  }

  /** Borra un apunte manual. La auditoría guarda cómo era, que es lo único que queda de él. */
  static async remove(id: number, meta?: MetaDeAuditoria) {
    const antes = await this.apunteManual(id);
    await db.transaccion.delete({ where: { id, reciboId: null } });
    AuditoriaService.log(ACCIONES_AUDITORIA.TRANSACCION_ELIMINAR, meta ?? {}, 'transaccion', id, { antes: foto(antes) });
    return { id };
  }

  static async getAll(query: Record<string, unknown> = {}) {
    const paginacion = sanearPaginacion(query);
    const filtros = leerFiltros(query);
    exigirFechasEnOrden(filtros);
    const where = whereContable(filtros);
    const [data, total] = await db.$transaction([
      db.transaccion.findMany({
        where,
        // Los apuntes de un mismo día comparten `fecha` al milisegundo (los de
        // demostración se generan con inicioDelDia): todos los órdenes acaban
        // en el id. Ver domain/ordenacion.ts.
        orderBy: ordenDe(ORDENES_LIBRO, query.orden),
        skip: paginacion.skip,
        take: paginacion.take,
        include: {
          categoria: { select: { nombre: true } }, // Traemos el nombre para que el Frontend lo pinte
          hermano: { select: { nombre: true, apellidos: true } },
          // De qué sorteo viene, si viene de la lotería: el libro enlaza allí en vez de dejarlo corregir.
          talonarioLoteria: { select: { sorteoId: true } },
          compraDeLoteria: { select: { id: true } },
          // Si es una venta de la caja: el libro enlaza a la caja.
          ventaDeCaja: { select: { id: true } },
        },
      }),
      db.transaccion.count({ where }),
    ]);
    return respuestaPaginada(data, total, paginacion);
  }

  /**
   * Lo que enseña la cabecera de la contabilidad para los mismos filtros que el
   * libro mayor: totales, el mismo tramo del año anterior, la serie por mes (o
   * por año) y el reparto por categoría.
   */
  static async getResumen(query: Record<string, unknown> = {}) {
    const filtros = leerFiltros(query);
    exigirFechasEnOrden(filtros);
    const where = whereContable(filtros);
    const anterior = periodoAnterior(filtros);

    const [porTipo, porCategoria, filas, categorias, porTipoAnterior, pendientes] = await Promise.all([
      db.transaccion.groupBy({ by: ['tipo'], where, _sum: { importe: true }, _count: { _all: true } }),
      db.transaccion.groupBy({ by: ['categoriaId'], where, _sum: { importe: true }, _count: { _all: true } }),
      // Solo tres columnas por apunte: la serie se agrupa por mes de Madrid, y
      // eso MariaDB no lo sabe hacer con groupBy de Prisma.
      db.transaccion.findMany({ where, select: { fecha: true, tipo: true, importe: true }, orderBy: { fecha: 'asc' } }),
      // También las inactivas: el historial sigue nombrando la categoría que ya no se usa.
      db.categoriaTransaccion.findMany({ select: { id: true, nombre: true, tipo: true } }),
      anterior
        ? db.transaccion.groupBy({ by: ['tipo'], where: whereContable({ ...filtros, ...anterior }), _sum: { importe: true } })
        : Promise.resolve(null),
      // Lo que falta por entrar, de todos los años y sin los filtros: no es un
      // movimiento del periodo, es lo que Tesorería tiene aún por cobrar. Los
      // devueltos van aparte: solo cuentan los que no se han reemitido.
      db.recibo.groupBy({
        by: ['estado'],
        where: { estado: { in: [EstadoPago.PENDIENTE, EstadoPago.REMESADO] } },
        _sum: { importe: true },
        _count: { _all: true },
      }),
    ]);

    // Y los devueltos que aún no se han reemitido: siguen sin cobrarse.
    const devueltos = await devueltosPendientes();
    const pendienteDe = (estado: EstadoPago) => pendientes.find((p) => p.estado === estado);
    const porCobrar = {
      importe: Math.round((pendientes.reduce((n, p) => n + Number(p._sum.importe ?? 0), 0) + devueltos.importe) * 100) / 100,
      recibos: pendientes.reduce((n, p) => n + p._count._all, 0) + devueltos.total,
      enElBanco: Number(pendienteDe(EstadoPago.REMESADO)?._sum.importe ?? 0),
      devueltos: devueltos.importe,
    };

    const suma = (grupos: { tipo: string; _sum: { importe: unknown } }[] | null, tipo: 'INGRESO' | 'GASTO') =>
      Number(grupos?.find((g) => g.tipo === tipo)?._sum.importe ?? 0);
    const apuntes = (tipo: 'INGRESO' | 'GASTO') => porTipo.find((g) => g.tipo === tipo)?._count._all ?? 0;
    const ingresos = suma(porTipo, 'INGRESO');
    const gastos = suma(porTipo, 'GASTO');

    // Sin fechas en el filtro, la serie va del primer apunte al último.
    const desde = filtros.desde ? inicioDiaMadrid(filtros.desde) : filas[0]?.fecha;
    const hasta = filtros.hasta ? inicioDiaMadrid(filtros.hasta) : filas.at(-1)?.fecha;
    const gran = desde && hasta ? granularidad(desde, hasta) : 'mes';
    const puntos = desde && hasta
      ? agruparEnSerie(filas.map((f) => ({ fecha: f.fecha, tipo: f.tipo, importe: Number(f.importe) })), gran, desde, hasta)
      : [];

    const nombres = new Map(categorias.map((c) => [c.id, c]));
    return {
      totales: {
        ingresos,
        gastos,
        resultado: Math.round((ingresos - gastos) * 100) / 100,
        apuntesIngreso: apuntes('INGRESO'),
        apuntesGasto: apuntes('GASTO'),
      },
      porCobrar,
      anterior: anterior && { ...anterior, ingresos: suma(porTipoAnterior, 'INGRESO'), gastos: suma(porTipoAnterior, 'GASTO') },
      serie: { granularidad: gran, puntos },
      categorias: porCategoria
        .map((g) => ({
          id: g.categoriaId,
          nombre: nombres.get(g.categoriaId)?.nombre ?? 'Sin categoría',
          tipo: nombres.get(g.categoriaId)?.tipo ?? 'GASTO',
          total: Number(g._sum.importe ?? 0),
          apuntes: g._count._all,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  // 3. LA JOYA DE LA CORONA: EL BALANCE GENERAL
  static async getBalance() {
    // Agrupamos y sumamos todos los importes, separados por INGRESO y GASTO
    const sumatorios = await db.transaccion.groupBy({
      by: ['tipo'],
      _sum: { importe: true }
    });

    let totalIngresos = 0;
    let totalGastos = 0;

    sumatorios.forEach(agrupacion => {
      const suma = Number(agrupacion._sum.importe) || 0;
      if (agrupacion.tipo === 'INGRESO') totalIngresos = suma;
      if (agrupacion.tipo === 'GASTO') totalGastos = suma;
    });

    // Céntimos exactos: restar en coma flotante deja colas (20.3 - 10.1 da
    // 10.200000000000001), y este número se pinta tal cual.
    const centimos = (n: number) => Math.round(n * 100) / 100;
    return {
      ingresos: centimos(totalIngresos),
      gastos: centimos(totalGastos),
      // Lo que queda limpio en la cuenta bancaria / caja
      balanceTotal: centimos(totalIngresos - totalGastos)
    };
  }
}
