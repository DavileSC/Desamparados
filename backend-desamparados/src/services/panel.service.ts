import { EstadoPago, TipoTransaccion, type TipoEvento } from '@prisma/client';
import db from '../config/db.js';
import { serieCensoMensual, ultimosMeses, claveMes, type MovimientoMensual } from '../domain/panel-censo.js';
import { agruparPorTextoLibre, type Recuento } from '../domain/panel-agrupar.js';

/**
 * REGLA DE ORO DE ESTE FICHERO
 *
 * Solo `count`, `groupBy` y `aggregate`. Prohibido `findMany` sobre Hermano y
 * sobre User: el panel es informativo y no puede enseñar datos de personas.
 * Única excepción: Evento, que son actos públicos.
 */

export interface PanelResponse {
  generadoEn: string;
  censo: {
    activos: number;
    altas12m: number;
    bajas12m: number;
    sinNumeroHermano: number;
    serieMensual: { mes: string; activos: number }[];
    porEdad: { tramo: string; total: number }[];
  };
  dinero: {
    porEstado: { estado: EstadoPago; total: number; importe: number }[];
    ejercicio: { anio: number; ingresos: number; gastos: number; saldo: number };
    serieMensual: { mes: string; ingresos: number; gastos: number }[];
    porCategoria: { categoria: string; tipo: TipoTransaccion; total: number }[];
  };
  procesion: {
    anio: number;
    papeletas: number;
    porAnio: { anio: number; total: number }[];
    porPuesto: Recuento[];
    porTalla: Recuento[];
    porAlturaHombro: { tramo: string; total: number }[];
  };
  actividad: {
    proximosEventos: { id: number; title: string; startDate: string; type: TipoEvento }[];
    noticias: { publicadas: number; borradores: number };
    publicaciones: { total: number; ultima: string | null };
    reparto: { turnosProximos: number; citasReservadas: number; capacidadEstimada: number };
  };
}

/** Tramos de altura de hombro, en cm, para prever cuántos varales de cada medida hacen falta. */
const TRAMOS_ALTURA = [
  { tramo: 'Menos de 160', min: 0, max: 159 },
  { tramo: '160-169', min: 160, max: 169 },
  { tramo: '170-179', min: 170, max: 179 },
  { tramo: '180 o más', min: 180, max: 300 },
];

const TRAMOS_EDAD = [
  { tramo: '0-17', min: 0, max: 17 },
  { tramo: '18-30', min: 18, max: 30 },
  { tramo: '31-45', min: 31, max: 45 },
  { tramo: '46-60', min: 46, max: 60 },
  { tramo: '61+', min: 61, max: 200 },
];

function edad(nacimiento: Date, hoy: Date): number {
  let anios = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) anios--;
  return anios;
}

/** Agrupa fechas por 'YYYY-MM' contando cuántas caen en cada mes. */
function contarPorMes(fechas: (Date | null)[]): MovimientoMensual[] {
  const cuenta = new Map<string, number>();
  for (const fecha of fechas) {
    if (!fecha) continue;
    const mes = claveMes(fecha);
    cuenta.set(mes, (cuenta.get(mes) ?? 0) + 1);
  }
  return [...cuenta.entries()].map(([mes, total]) => ({ mes, total }));
}

export class PanelService {
  static async getPanel(): Promise<PanelResponse> {
    const hoy = new Date();
    const anio = hoy.getUTCFullYear();
    const meses = ultimosMeses(hoy, 12);
    const haceUnAnio = new Date(Date.UTC(anio - 1, hoy.getUTCMonth(), hoy.getUTCDate()));
    const inicioEjercicio = new Date(Date.UTC(anio, 0, 1));

    const [
      activos,
      altas12m,
      bajas12m,
      sinNumeroHermano,
      fechasAlta,
      fechasBaja,
      nacimientos,
      recibosPorEstado,
      transaccionesPorTipo,
      transaccionesPorCategoria,
      transaccionesPorMes,
      papeletasPorAnio,
      puestos,
      tallas,
      alturas,
      proximosEventos,
      noticiasPublicadas,
      noticiasBorradores,
      publicaciones,
      ultimaPublicacion,
      turnosProximos,
      citasReservadas,
      capacidad,
    ] = await Promise.all([
      db.hermano.count({ where: { activo: true } }),
      db.hermano.count({ where: { fechaAlta: { gte: haceUnAnio } } }),
      db.hermano.count({ where: { fechaBaja: { gte: haceUnAnio } } }),
      db.hermano.count({ where: { activo: true, numeroHermano: null } }),
      db.hermano.groupBy({ by: ['fechaAlta'], _count: { _all: true }, where: { fechaAlta: { gte: haceUnAnio } } }),
      db.hermano.groupBy({ by: ['fechaBaja'], _count: { _all: true }, where: { fechaBaja: { gte: haceUnAnio } } }),
      db.hermano.groupBy({ by: ['fechaNacimiento'], _count: { _all: true }, where: { activo: true } }),
      db.recibo.groupBy({ by: ['estado'], _count: { _all: true }, _sum: { importe: true } }),
      db.transaccion.groupBy({ by: ['tipo'], _sum: { importe: true }, where: { fecha: { gte: inicioEjercicio } } }),
      db.transaccion.groupBy({ by: ['categoriaId', 'tipo'], _count: { _all: true }, where: { fecha: { gte: inicioEjercicio } } }),
      db.transaccion.groupBy({ by: ['tipo', 'fecha'], _sum: { importe: true }, where: { fecha: { gte: haceUnAnio } } }),
      db.papeletaSitio.groupBy({ by: ['year'], _count: { _all: true } }),
      db.papeletaSitio.groupBy({ by: ['puesto'], _count: { _all: true }, where: { year: anio } }),
      db.hermano.groupBy({ by: ['tunica'], _count: { _all: true }, where: { activo: true } }),
      db.hermano.groupBy({ by: ['alturaHombro'], _count: { _all: true }, where: { activo: true, alturaHombro: { not: null } } }),
      db.evento.findMany({
        where: { startDate: { gte: hoy } },
        orderBy: { startDate: 'asc' },
        take: 5,
        select: { id: true, title: true, startDate: true, type: true },
      }),
      db.noticia.count({ where: { visible: true } }),
      db.noticia.count({ where: { visible: false } }),
      db.publicacion.count(),
      db.publicacion.aggregate({ _max: { fecha: true } }),
      db.turno.count({ where: { fecha: { gte: hoy }, activo: true } }),
      db.cita.count({ where: { estado: 'RESERVADA' } }),
      db.turno.aggregate({ _sum: { capacidadEstimada: true }, where: { fecha: { gte: hoy }, activo: true } }),
    ]);

    // Las categorías se resuelven aparte: groupBy devuelve el id, no el nombre.
    const categorias = await db.categoriaTransaccion.findMany({ select: { id: true, nombre: true } });
    const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));

    const ingresos = Number(
      transaccionesPorTipo.find((t) => t.tipo === TipoTransaccion.INGRESO)?._sum.importe ?? 0,
    );
    const gastos = Number(
      transaccionesPorTipo.find((t) => t.tipo === TipoTransaccion.GASTO)?._sum.importe ?? 0,
    );

    const porEdad = TRAMOS_EDAD.map(({ tramo, min, max }) => ({
      tramo,
      total: nacimientos
        .filter((n) => {
          const e = edad(n.fechaNacimiento, hoy);
          return e >= min && e <= max;
        })
        .reduce((suma, n) => suma + n._count._all, 0),
    }));

    // Ingresos y gastos mes a mes. groupBy agrupa por fecha exacta, así que el
    // reparto por mes se hace aquí, sobre las sumas ya calculadas.
    const serieDinero = meses.map((mes) => {
      const delMes = transaccionesPorMes.filter((t) => claveMes(t.fecha) === mes);
      const suma = (tipo: TipoTransaccion) =>
        delMes.filter((t) => t.tipo === tipo).reduce((s, t) => s + Number(t._sum.importe ?? 0), 0);
      return { mes, ingresos: suma(TipoTransaccion.INGRESO), gastos: suma(TipoTransaccion.GASTO) };
    });

    // Cuántos hermanos hay de cada altura de hombro: es lo que decide cuántos
    // varales de cada medida hay que preparar.
    const porAlturaHombro = TRAMOS_ALTURA.map(({ tramo, min, max }) => ({
      tramo,
      total: alturas
        .filter((a) => a.alturaHombro !== null && a.alturaHombro >= min && a.alturaHombro <= max)
        .reduce((suma, a) => suma + a._count._all, 0),
    }));

    // groupBy da una fila por valor distinto; agruparPorTextoLibre espera la
    // lista repetida, así que se expande por su recuento.
    const expandir = <T extends { _count: { _all: number } }>(filas: T[], valor: (f: T) => string | null) =>
      filas.flatMap((f) => new Array<string | null>(f._count._all).fill(valor(f)));

    return {
      generadoEn: hoy.toISOString(),
      censo: {
        activos,
        altas12m,
        bajas12m,
        sinNumeroHermano,
        serieMensual: serieCensoMensual(
          activos,
          contarPorMes(fechasAlta.flatMap((f) => new Array(f._count._all).fill(f.fechaAlta))),
          contarPorMes(fechasBaja.flatMap((f) => new Array(f._count._all).fill(f.fechaBaja))),
          meses,
        ),
        porEdad,
      },
      dinero: {
        porEstado: recibosPorEstado.map((r) => ({
          estado: r.estado,
          total: r._count._all,
          importe: Number(r._sum.importe ?? 0),
        })),
        ejercicio: { anio, ingresos, gastos, saldo: ingresos - gastos },
        serieMensual: serieDinero,
        porCategoria: transaccionesPorCategoria.map((t) => ({
          categoria: nombreCategoria.get(t.categoriaId) ?? 'Sin categoría',
          tipo: t.tipo,
          total: t._count._all,
        })),
      },
      procesion: {
        anio,
        papeletas: puestos.reduce((suma, p) => suma + p._count._all, 0),
        porAnio: papeletasPorAnio
          .map((p) => ({ anio: p.year, total: p._count._all }))
          .sort((a, b) => a.anio - b.anio)
          .slice(-5),
        porPuesto: agruparPorTextoLibre(expandir(puestos, (p) => p.puesto)),
        porTalla: agruparPorTextoLibre(expandir(tallas, (t) => t.tunica)),
        porAlturaHombro,
      },
      actividad: {
        proximosEventos: proximosEventos.map((e) => ({
          id: e.id,
          title: e.title,
          startDate: e.startDate.toISOString(),
          type: e.type,
        })),
        noticias: { publicadas: noticiasPublicadas, borradores: noticiasBorradores },
        publicaciones: {
          total: publicaciones,
          ultima: ultimaPublicacion._max.fecha?.toISOString() ?? null,
        },
        reparto: {
          turnosProximos,
          citasReservadas,
          capacidadEstimada: capacidad._sum.capacidadEstimada ?? 0,
        },
      },
    };
  }
}
