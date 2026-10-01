import { EstadoPago, Prisma, TipoRecibo, TipoTransaccion } from '@prisma/client';
import db from '../config/db.js';
import { claveMes } from '../domain/panel-censo.js';
import { agruparPorTextoLibre } from '../domain/panel-agrupar.js';
import { periodoAnterior, periodoDe, periodosDisponibles, type Periodo } from '../domain/periodo-datos.js';
import { areasDe, type Area, type DatosCrudos } from '../domain/datos-areas.js';
import { devueltosPendientes } from './recibos/comunes.js';
import { SalidasService } from './procesion/salidas.service.js';

/**
 * REGLA DE ORO, la misma que la del panel del Inicio: solo `count`, `groupBy` y
 * `aggregate` (y un AVG en SQL para la edad media). Nada de `findMany` sobre
 * Hermano ni User: «Datos e informes» y el Informe anual son cifras de conjunto y no
 * pueden sacar datos de una persona.
 *
 * Tres excepciones, ninguna toca datos de nadie: los actos de la Agenda (son
 * públicos), el catálogo de categorías contables (un nombre, como «Donativos»)
 * y los enseres del inventario (piezas del Grupo).
 */

export interface DatosResponse {
  generadoEn: string;
  periodo: Omit<Periodo, 'inicio' | 'fin'>;
  periodos: { clave: string; etiqueta: string }[];
  areas: Area[];
}

const euros2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Quién era hermano en un instante: dado de alta antes, alta aprobada (activo o
 * con baja; una solicitud pendiente no cuenta) y sin baja todavía entonces. Si
 * el instante es de ahora o del futuro, los activos de hoy, sin más.
 */
function whereHermanosEn(instante: Date, hoy: Date): Prisma.HermanoWhereInput {
  if (instante >= hoy) return { activo: true };
  return {
    fechaAlta: { lt: instante },
    AND: [
      { OR: [{ activo: true }, { fechaBaja: { not: null } }] },
      { OR: [{ fechaBaja: null }, { fechaBaja: { gte: instante } }] },
    ],
  };
}

const TRAMOS_EDAD = [
  { tramo: 'Menos de 18', min: 0, max: 17 },
  { tramo: 'De 18 a 30', min: 18, max: 30 },
  { tramo: 'De 31 a 45', min: 31, max: 45 },
  { tramo: 'De 46 a 60', min: 46, max: 60 },
  { tramo: 'De 61 a 75', min: 61, max: 75 },
  { tramo: 'Más de 75', min: 76, max: 200 },
];

/** Nacidos para tener entre `min` y `max` años en `dia`: filtro de count, la fecha no sale de la consulta. */
function nacidosEntre(dia: Date, min: number, max: number) {
  const lte = new Date(Date.UTC(dia.getUTCFullYear() - min, dia.getUTCMonth(), dia.getUTCDate()));
  const gt = new Date(Date.UTC(dia.getUTCFullYear() - (max + 1), dia.getUTCMonth(), dia.getUTCDate()));
  return { lte, gt };
}

/** Cuenta por mes (de Madrid) unas filas de groupBy por fecha, en los meses del periodo. */
function porMes<T>(filas: T[], fecha: (f: T) => Date | null, cuantos: (f: T) => number, meses: string[]) {
  const cuenta = new Map(meses.map((m) => [m, 0]));
  for (const f of filas) {
    const d = fecha(f);
    if (!d) continue;
    const mes = claveMes(d);
    if (cuenta.has(mes)) cuenta.set(mes, (cuenta.get(mes) ?? 0) + cuantos(f));
  }
  return meses.map((mes) => ({ mes, total: cuenta.get(mes) ?? 0 }));
}

const enRango = (p: { inicio: Date; fin: Date }) => ({ gte: p.inicio, lt: p.fin });

async function datosCrudos(p: Periodo, hoy: Date): Promise<DatosCrudos> {
  // El año anterior entero, o hasta el mismo día si este va en marcha.
  const antes = periodoAnterior(p, hoy);
  // El instante del cierre: el final del periodo o ahora, lo que llegue antes.
  const cierre = p.fin < hoy ? p.fin : hoy;
  const altasAprobadas = { OR: [{ activo: true }, { fechaBaja: { not: null } }] } satisfies Prisma.HermanoWhereInput;
  const cincoPeriodos = [4, 3, 2, 1, 0].map((n) => periodoDe(p.anio - n, hoy));

  // Los recibos por cobrar del año, y de ellos los de las papeletas de su salida.
  const recibosDelPeriodo: Prisma.ReciboWhereInput = { year: p.anio };
  const papeletasPorCobrar: Prisma.ReciboWhereInput = { tipo: TipoRecibo.PAPELETA_SITIO, year: p.anio };
  const vivos = [EstadoPago.PENDIENTE, EstadoPago.REMESADO];

  const [
    activos, activosAlEmpezar, altas, bajas, altasAntes, bajasAntes, bajasPorMotivo, fechasAlta, fechasBaja, cierres, edad, porEdad,
    tiposDinero, tiposDineroAntes, dineroPorFecha, dineroPorCategoria, categorias, recibosVivos, devueltos,
    salidas, papeletasVivas, papeletasDevueltas,
    enseres, prendas,
    noticias, publicaciones, versiones, noticiasAntes, publicacionesAntes, boletin, activosHoy,
    actos, actosAntes,
  ] = await Promise.all([
    db.hermano.count({ where: whereHermanosEn(cierre, hoy) }),
    db.hermano.count({ where: whereHermanosEn(p.inicio, hoy) }),
    db.hermano.count({ where: { ...altasAprobadas, fechaAlta: enRango(p) } }),
    db.hermano.count({ where: { fechaBaja: enRango(p) } }),
    db.hermano.count({ where: { ...altasAprobadas, fechaAlta: enRango(antes) } }),
    db.hermano.count({ where: { fechaBaja: enRango(antes) } }),
    db.hermano.groupBy({ by: ['motivoBaja'], _count: { _all: true }, where: { fechaBaja: enRango(p) } }),
    db.hermano.groupBy({ by: ['fechaAlta'], _count: { _all: true }, where: { ...altasAprobadas, fechaAlta: enRango(p) } }),
    db.hermano.groupBy({ by: ['fechaBaja'], _count: { _all: true }, where: { fechaBaja: enRango(p) } }),
    Promise.all(cincoPeriodos.map((q) => db.hermano.count({ where: whereHermanosEn(q.fin < hoy ? q.fin : hoy, hoy) }))),
    // La media de edad al cierre: una sola cifra de conjunto, calculada en SQL.
    (async () => {
      const w = cierre >= hoy
        ? Prisma.sql`activo = 1`
        : Prisma.sql`fechaAlta < ${cierre} AND (activo = 1 OR fechaBaja IS NOT NULL) AND (fechaBaja IS NULL OR fechaBaja >= ${cierre})`;
      const [fila] = await db.$queryRaw<{ media: number | null; menores: bigint | number | null }[]>(
        Prisma.sql`SELECT AVG(TIMESTAMPDIFF(YEAR, fechaNacimiento, ${cierre})) AS media,
                          SUM(fechaNacimiento > DATE_SUB(${cierre}, INTERVAL 18 YEAR)) AS menores
                   FROM Hermano WHERE ${w}`,
      );
      return { media: fila?.media === null || fila?.media === undefined ? null : Number(fila.media), menores: Number(fila?.menores ?? 0) };
    })(),
    Promise.all(TRAMOS_EDAD.map(({ min, max }) => db.hermano.count({ where: { AND: [whereHermanosEn(cierre, hoy), { fechaNacimiento: nacidosEntre(cierre, min, max) }] } }))),

    db.transaccion.groupBy({ by: ['tipo'], _sum: { importe: true }, where: { fecha: enRango(p) } }),
    db.transaccion.groupBy({ by: ['tipo'], _sum: { importe: true }, where: { fecha: enRango(antes) } }),
    db.transaccion.groupBy({ by: ['tipo', 'fecha'], _sum: { importe: true }, where: { fecha: enRango(p) } }),
    db.transaccion.groupBy({ by: ['categoriaId', 'tipo'], _sum: { importe: true }, where: { fecha: enRango(p) } }),
    db.categoriaTransaccion.findMany({ select: { id: true, nombre: true } }),
    db.recibo.groupBy({ by: ['estado'], _count: { _all: true }, _sum: { importe: true }, where: { ...recibosDelPeriodo, estado: { in: vivos } } }),
    devueltosPendientes(recibosDelPeriodo),

    // Cada salida activa con sus cifras; la serie de cinco años, solo en las
    // que llevan ropa (las grandes, las de la Semana Santa).
    SalidasService.listar().then((lista) => Promise.all(lista.map(async (s) => {
      const [total, anterior, porPuesto, porAnio] = await Promise.all([
        db.papeletaSitio.count({ where: { year: p.anio, salidaId: s.id } }),
        db.papeletaSitio.count({ where: { year: p.anio - 1, salidaId: s.id } }),
        db.papeletaSitio.groupBy({ by: ['puesto'], _count: { _all: true }, where: { year: p.anio, salidaId: s.id } }),
        s.conRopa
          ? db.papeletaSitio.groupBy({ by: ['year'], _count: { _all: true }, where: { salidaId: s.id, year: { gt: p.anio - 5, lte: p.anio } } })
          : Promise.resolve(null),
      ]);
      return { slug: s.slug, nombre: s.nombre, conRopa: s.conRopa, total, anterior, porPuesto, porAnio };
    }))),
    db.recibo.groupBy({ by: ['estado'], _count: { _all: true }, _sum: { importe: true }, where: { ...papeletasPorCobrar, estado: { in: vivos } } }),
    devueltosPendientes(papeletasPorCobrar),

    db.enser.findMany({ select: { nombre: true, cantidadOptimo: true, cantidadBueno: true, cantidadReparar: true, cantidadTotal: true }, orderBy: [{ cantidadTotal: 'desc' }, { nombre: 'asc' }] }),
    db.prenda.groupBy({ by: ['tipo', 'estado'], _count: { _all: true } }),

    db.noticia.groupBy({ by: ['fecha'], _count: { _all: true }, where: { visible: true, fecha: enRango(p) } }),
    db.publicacion.groupBy({ by: ['fecha'], _count: { _all: true }, where: { visible: true, fecha: enRango(p) } }),
    db.versionContenido.groupBy({ by: ['slug', 'createdAt'], _count: { _all: true }, where: { createdAt: enRango(p) } }),
    db.noticia.count({ where: { visible: true, fecha: enRango(antes) } }),
    db.publicacion.count({ where: { visible: true, fecha: enRango(antes) } }),
    db.hermano.count({ where: { activo: true, boletin: true } }),
    db.hermano.count({ where: { activo: true } }),

    db.evento.findMany({ where: { startDate: enRango(p) }, orderBy: { startDate: 'asc' }, select: { id: true, title: true, startDate: true, type: true, location: true } }),
    db.evento.count({ where: { startDate: enRango(antes) } }),
  ]);

  const suma = (filas: { tipo: TipoTransaccion; _sum: { importe: Prisma.Decimal | null } }[], tipo: TipoTransaccion) =>
    euros2(Number(filas.find((f) => f.tipo === tipo)?._sum.importe ?? 0));
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
  const partes = (vivosFilas: typeof recibosVivos, devueltosFila: { total: number; importe: number }) => [
    ...vivosFilas.map((r) => ({ estado: r.estado as 'PENDIENTE' | 'REMESADO', total: r._count._all, importe: euros2(Number(r._sum.importe ?? 0)) })),
    { estado: 'DEVUELTO' as const, ...devueltosFila },
  ];
  const expandir = (filas: { puesto: string; _count: { _all: number } }[]) => filas.flatMap((f) => new Array<string>(f._count._all).fill(f.puesto));

  const altasMes = porMes(fechasAlta, (f) => f.fechaAlta, (f) => f._count._all, p.meses);
  const bajasMes = porMes(fechasBaja, (f) => f.fechaBaja, (f) => f._count._all, p.meses);

  return {
    hermanos: {
      activos,
      activosAlEmpezar,
      altas,
      bajas,
      anterior: { altas: altasAntes, bajas: bajasAntes },
      bajasPorMotivo: bajasPorMotivo.map((m) => ({ motivo: m.motivoBaja, total: m._count._all })),
      porMes: p.meses.map((mes, i) => ({ mes, altas: altasMes[i].total, bajas: bajasMes[i].total })),
      cierres: cincoPeriodos.map((q, i) => ({ etiqueta: String(q.anio), activos: cierres[i] })),
      edadMedia: edad.media === null ? null : Math.round(edad.media * 10) / 10,
      menores: edad.menores,
      porEdad: TRAMOS_EDAD.map(({ tramo }, i) => ({ tramo, total: porEdad[i] })),
    },
    dinero: {
      ingresos: suma(tiposDinero, TipoTransaccion.INGRESO),
      gastos: suma(tiposDinero, TipoTransaccion.GASTO),
      anterior: { ingresos: suma(tiposDineroAntes, TipoTransaccion.INGRESO), gastos: suma(tiposDineroAntes, TipoTransaccion.GASTO) },
      porMes: p.meses.map((mes) => {
        const delMes = dineroPorFecha.filter((t) => claveMes(t.fecha) === mes);
        const de = (tipo: TipoTransaccion) => euros2(delMes.filter((t) => t.tipo === tipo).reduce((s, t) => s + Number(t._sum.importe ?? 0), 0));
        return { mes, ingresos: de(TipoTransaccion.INGRESO), gastos: de(TipoTransaccion.GASTO) };
      }),
      porCategoria: dineroPorCategoria.map((c) => ({ categoria: nombreCategoria.get(c.categoriaId) ?? 'Sin categoría', tipo: c.tipo, importe: euros2(Number(c._sum.importe ?? 0)) })),
      porCobrar: partes(recibosVivos, devueltos),
    },
    procesion: {
      anio: p.anio,
      porSalida: salidas.map((s) => {
        const delAnio = new Map((s.porAnio ?? []).map((f) => [f.year, f._count._all]));
        return {
          slug: s.slug,
          nombre: s.nombre,
          conRopa: s.conRopa,
          papeletas: s.total,
          papeletasAnioAnterior: s.anterior,
          porPuesto: agruparPorTextoLibre(expandir(s.porPuesto), 8),
          ...(s.porAnio && { serie: [4, 3, 2, 1, 0].map((n) => ({ anio: p.anio - n, total: delAnio.get(p.anio - n) ?? 0 })) }),
        };
      }),
      porCobrar: partes(papeletasVivas, papeletasDevueltas),
    },
    inventario: {
      enseres: enseres.map((e) => ({ nombre: e.nombre, optimo: e.cantidadOptimo, bueno: e.cantidadBueno, reparar: e.cantidadReparar, total: e.cantidadTotal })),
      prendas: prendas.map((x) => ({ tipo: x.tipo, estado: x.estado, total: x._count._all })),
    },
    web: {
      noticias: noticias.reduce((s, f) => s + f._count._all, 0),
      publicaciones: publicaciones.reduce((s, f) => s + f._count._all, 0),
      cambios: versiones.reduce((s, f) => s + f._count._all, 0),
      paginasTocadas: new Set(versiones.map((v) => v.slug)).size,
      anterior: { noticias: noticiasAntes, publicaciones: publicacionesAntes },
      noticiasPorMes: porMes(noticias, (f) => f.fecha, (f) => f._count._all, p.meses),
      publicacionesPorMes: porMes(publicaciones, (f) => f.fecha, (f) => f._count._all, p.meses),
      cambiosPorMes: porMes(versiones, (f) => f.createdAt, (f) => f._count._all, p.meses),
      boletin,
      activos: activosHoy,
    },
    agenda: {
      actos: actos.map((a) => ({ id: a.id, title: a.title, startDate: a.startDate.toISOString(), type: a.type, location: a.location })),
      anterior: actosAntes,
    },
  };
}

export class DatosService {
  static async crudos(p: Periodo, hoy = new Date()): Promise<DatosCrudos> {
    return datosCrudos(p, hoy);
  }

  static async leer(p: Periodo, hoy = new Date()): Promise<DatosResponse> {
    const crudos = await datosCrudos(p, hoy);
    const { inicio: _i, fin: _f, ...periodo } = p;
    return { generadoEn: hoy.toISOString(), periodo, periodos: periodosDisponibles(hoy), areas: areasDe(crudos, p, hoy) };
  }
}
