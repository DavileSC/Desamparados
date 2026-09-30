import { EstadoPago, TipoTransaccion, type TipoEvento } from '@prisma/client';
import db from '../config/db.js';
import { serieCensoMensual, claveMes, whereAltasAprobadas, type MovimientoMensual } from '../domain/panel-censo.js';
import { diaMadrid, inicioDiaMadrid, unAnioAntes } from '../domain/contabilidad.js';
import { agruparPorTextoLibre, type Recuento } from '../domain/panel-agrupar.js';
import {
  leerEjercicio,
  mesesDelEjercicio,
  mesesParaReconstruir,
  rangoDeMeses,
  rangoDelEjercicio,
} from '../domain/panel-ejercicio.js';
import { devueltosPendientes } from './recibos/comunes.js';

/**
 * REGLA DE ORO DE ESTE FICHERO
 *
 * Solo `count`, `groupBy` y `aggregate`. Prohibido `findMany` sobre Hermano y
 * sobre User: el panel es informativo y no puede enseñar datos de personas.
 *
 * Dos excepciones, ninguna de las dos toca datos de una persona:
 *   - Evento: son actos públicos (los próximos, los del mes para el calendario y
 *     los del curso para el camino a la estación).
 *   - CategoriaTransaccion: es un catálogo (id, nombre de la categoría
 *     contable, p. ej. "Donativos"), no un dato de un hermano ni de un
 *     usuario. Se necesita en `findMany` porque `groupBy` sobre Transaccion
 *     solo puede devolver el `categoriaId`, no el nombre.
 *
 * El Inicio ya no consulta AuditLog: la auditoría es privada y vive en su
 * propia sección, que solo ven ADMIN y HERMANO_MAYOR.
 */

export interface PanelResponse {
  generadoEn: string;
  /** Ejercicio que acota el dinero, la procesión y la serie del censo. */
  ejercicio: { anio: number; cerrado: boolean };
  censo: {
    activos: number;
    altas12m: number;
    bajas12m: number;
    sinNumeroHermano: number;
    serieMensual: { mes: string; activos: number }[];
    /** Altas y bajas de cada uno de los meses de `serieMensual`. */
    movimientosMensuales: { mes: string; altas: number; bajas: number }[];
    porEdad: { tramo: string; total: number }[];
  };
  dinero: {
    porEstado: { estado: EstadoPago; total: number; importe: number }[];
    /** Los devueltos del ejercicio que aún no se han reemitido: lo que de verdad queda por cobrar y reemitir. */
    devueltosPendientes: { total: number; importe: number };
    /**
     * Lo que sigue sin cobrarse de ejercicios anteriores (pendiente, en el banco
     * o devuelto sin reemitir). La cifra del Inicio es la del ejercicio; esto es
     * lo que falta para llegar a la de Contabilidad, que cuenta todos los años.
     */
    anterioresPorCobrar: { total: number; importe: number };
    ejercicio: { anio: number; ingresos: number; gastos: number; saldo: number };
    serieMensual: { mes: string; ingresos: number; gastos: number }[];
    porCategoria: { categoria: string; tipo: TipoTransaccion; total: number; importe: number }[];
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
  /**
   * El mes en curso (en Madrid) para el calendario del Inicio: sus actos y los
   * días con turno de reparto de papeletas. No lo toca el selector de
   * ejercicio: es la agenda de ahora.
   */
  calendario: {
    mes: string;
    eventos: { id: number; title: string; startDate: string; type: TipoEvento }[];
    diasDeReparto: string[];
  };
  /**
   * Todos los actos del año natural en marcha (del 1 de enero al 31 de
   * diciembre, en Madrid), pasados y por venir: el Inicio los reparte en
   * tandas. No lo toca el selector de ejercicio: es siempre el de hoy.
   */
  anio: {
    /** Con hora (en startDate) y lugar: el Inicio enseña el próximo acto entero. */
    eventos: { id: number; title: string; startDate: string; type: TipoEvento; location: string | null }[];
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

/**
 * Límites de fecha de nacimiento de un tramo de edad, en el mismo día del año
 * que `hoy`. Se usan como filtro de `count`, nunca se trae la fecha en sí:
 * un `groupBy(['fechaNacimiento'])` devolvería una fila por persona, que es
 * la fecha de nacimiento exacta de cada hermano viajando fuera de la base de
 * datos. Con `count` el dato personal no sale nunca de la consulta SQL.
 */
function rangoEdad(hoy: Date, min: number, max: number): { lte: Date; gt: Date } {
  const lte = new Date(Date.UTC(hoy.getUTCFullYear() - min, hoy.getUTCMonth(), hoy.getUTCDate()));
  const gt = new Date(Date.UTC(hoy.getUTCFullYear() - (max + 1), hoy.getUTCMonth(), hoy.getUTCDate()));
  return { lte, gt };
}

/**
 * Redondea a dos decimales. `LineaTemporal` pinta el último valor de cada
 * serie tal cual, en crudo, como etiqueta de texto: sin este redondeo, la
 * suma de varios `Number(...)` por mes puede dejar arrastre binario en
 * pantalla (p. ej. 1234.5600000000002).
 */
const euros2 = (n: number) => Math.round(n * 100) / 100;

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
  static async getPanel(anioSolicitado?: unknown): Promise<PanelResponse> {
    const hoy = new Date();
    // Días, meses y años de Madrid, con los mismos helpers que la contabilidad:
    // en UTC, el ejercicio perdía la primera hora del 1 de enero y lo cobrado la
    // primera hora del día 1 de cada mes caía en el mes anterior.
    const diaHoy = diaMadrid(hoy);
    const ejercicio = leerEjercicio(anioSolicitado, hoy);
    const anio = ejercicio.anio;

    // Los meses que se enseñan y los que hay que recorrer para reconstruir el
    // censo hacia atrás desde los activos de hoy. Con el año en curso son los
    // mismos; con uno cerrado, el recorrido llega hasta el mes de hoy.
    const meses = mesesDelEjercicio(ejercicio, hoy);
    const mesesRecorridos = mesesParaReconstruir(meses, hoy);
    // Dos rangos distintos a propósito: el dinero solo necesita los meses que se
    // enseñan, y el censo necesita además todo lo que va desde ahí hasta hoy.
    const rangoDinero = rangoDeMeses(meses);
    const rangoCenso = rangoDeMeses(mesesRecorridos);
    const { desde: inicioEjercicio, hasta: finEjercicio } = rangoDelEjercicio(anio);

    // Las altas y bajas de los últimos doce meses son cifras DE HOY (van en la
    // tarjeta de hermanos activos), así que no las toca el selector.
    const haceUnAnio = inicioDiaMadrid(unAnioAntes(diaHoy));
    const mesHoy = diaHoy.slice(0, 7);
    const rangoMesHoy = rangoDeMeses([mesHoy]);
    const anioHoy = Number(diaHoy.slice(0, 4));
    const rangoAnio = { desde: inicioDiaMadrid(`${anioHoy}-01-01`), hasta: inicioDiaMadrid(`${anioHoy + 1}-01-01`) };
    const altasUltimoAnio = whereAltasAprobadas(haceUnAnio);
    // Las de la serie, en cambio, cubren todo el recorrido de reconstrucción.
    const altasDelRecorrido = whereAltasAprobadas(rangoCenso.desde);

    const [
      activos,
      altas12m,
      bajas12m,
      sinNumeroHermano,
      fechasAlta,
      fechasBaja,
      porEdadCounts,
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
      categorias,
      eventosDelMes,
      turnosDelMes,
      eventosDelAnio,
    ] = await Promise.all([
      db.hermano.count({ where: { activo: true } }),
      // Las solicitudes pendientes no son altas (ver whereAltasAprobadas).
      db.hermano.count({ where: altasUltimoAnio }),
      db.hermano.count({ where: { fechaBaja: { gte: haceUnAnio } } }),
      db.hermano.count({ where: { activo: true, numeroHermano: null } }),
      db.hermano.groupBy({
        by: ['fechaAlta'],
        _count: { _all: true },
        // No se spreadea altasDelRecorrido entero: ya trae su propio
        // `fechaAlta: { gte }`, y ponerlo junto a un `fechaAlta` propio aquí
        // debajo lo pisaría en silencio (el literal que va después gana). Solo
        // "funcionaba" porque los dos usan el mismo rangoCenso.desde. Se toma
        // solo el OR de altas aprobadas del helper y el rango de fechaAlta se
        // escribe completo y explícito, con el tope superior que ese OR no
        // lleva (gte y lt por simetría con rangoDinero: sin el lt, un alta
        // futura, poco probable pero no imposible con datos mal cargados,
        // contaría de más).
        where: { OR: altasDelRecorrido.OR, fechaAlta: { gte: rangoCenso.desde, lt: rangoCenso.hasta } },
      }),
      db.hermano.groupBy({
        by: ['fechaBaja'],
        _count: { _all: true },
        where: { fechaBaja: { gte: rangoCenso.desde, lt: rangoCenso.hasta } },
      }),
      // Un count por tramo, no un groupBy: ver el comentario de rangoEdad().
      Promise.all(
        TRAMOS_EDAD.map(({ min, max }) =>
          db.hermano.count({ where: { activo: true, fechaNacimiento: rangoEdad(hoy, min, max) } }),
        ),
      ),
      // Del ejercicio elegido: mezclando años, el «% cobrado» salía diluido por
      // ejercicios ya liquidados. El índice @@index([year]) ya existe.
      db.recibo.groupBy({
        by: ['estado'],
        _count: { _all: true },
        _sum: { importe: true },
        where: { year: anio },
      }),
      db.transaccion.groupBy({
        by: ['tipo'],
        _sum: { importe: true },
        where: { fecha: { gte: inicioEjercicio, lt: finEjercicio } },
      }),
      db.transaccion.groupBy({
        by: ['categoriaId', 'tipo'],
        _count: { _all: true },
        _sum: { importe: true },
        where: { fecha: { gte: inicioEjercicio, lt: finEjercicio } },
      }),
      db.transaccion.groupBy({
        by: ['tipo', 'fecha'],
        _sum: { importe: true },
        where: { fecha: { gte: rangoDinero.desde, lt: rangoDinero.hasta } },
      }),
      // Los cinco años HASTA el elegido: la gráfica destaca el ejercicio, y con
      // los cinco últimos absolutos un año antiguo no aparecería en su propia
      // gráfica.
      db.papeletaSitio.groupBy({ by: ['year'], _count: { _all: true }, where: { year: { lte: anio } } }),
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
      // Catálogo de categorías contables (excepción de la regla de oro: sin
      // datos personales). Hace falta el nombre, no solo el id que da groupBy.
      db.categoriaTransaccion.findMany({ select: { id: true, nombre: true } }),
      db.evento.findMany({
        where: { startDate: { gte: rangoMesHoy.desde, lt: rangoMesHoy.hasta } },
        orderBy: { startDate: 'asc' },
        select: { id: true, title: true, startDate: true, type: true },
      }),
      // groupBy y no findMany: solo hace falta saber qué días hay reparto.
      db.turno.groupBy({ by: ['fecha'], where: { fecha: { gte: rangoMesHoy.desde, lt: rangoMesHoy.hasta }, activo: true } }),
      db.evento.findMany({
        where: { startDate: { gte: rangoAnio.desde, lt: rangoAnio.hasta } },
        orderBy: { startDate: 'asc' },
        select: { id: true, title: true, startDate: true, type: true, location: true },
      }),
    ]);

    const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
    const [devueltosDelEjercicio, devueltosAnteriores, vivosAnteriores] = await Promise.all([
      devueltosPendientes({ year: anio }),
      devueltosPendientes({ year: { lt: anio } }),
      db.recibo.aggregate({
        where: { year: { lt: anio }, estado: { in: [EstadoPago.PENDIENTE, EstadoPago.REMESADO] } },
        _count: { _all: true },
        _sum: { importe: true },
      }),
    ]);

    const ingresos = euros2(
      Number(transaccionesPorTipo.find((t) => t.tipo === TipoTransaccion.INGRESO)?._sum.importe ?? 0),
    );
    const gastos = euros2(
      Number(transaccionesPorTipo.find((t) => t.tipo === TipoTransaccion.GASTO)?._sum.importe ?? 0),
    );

    const porEdad = TRAMOS_EDAD.map(({ tramo }, i) => ({ tramo, total: porEdadCounts[i] }));

    // Altas y bajas del recorrido completo, ya agrupadas por mes: se dejan en
    // constantes con nombre (y no solo dentro de la llamada) porque la
    // siguiente tarea las necesita por separado.
    const altasPorMes = contarPorMes(fechasAlta.flatMap((f) => new Array(f._count._all).fill(f.fechaAlta)));
    const bajasPorMes = contarPorMes(fechasBaja.flatMap((f) => new Array(f._count._all).fill(f.fechaBaja)));
    // serieCensoMensual reconstruye hacia atrás desde hoy con TODO el recorrido
    // (mesesRecorridos); aquí se recorta a los meses que de verdad se enseñan.
    const serieCompleta = serieCensoMensual(activos, altasPorMes, bajasPorMes, mesesRecorridos);
    const mesesMostrados = new Set(meses);
    const serieCenso = serieCompleta.filter((p) => mesesMostrados.has(p.mes));

    // Los movimientos ya estaban calculados para reconstruir la serie; lo único
    // que faltaba era mandarlos. Los meses sin movimiento van a cero, no
    // ausentes: la gráfica necesita las doce ranuras.
    const porMes = (lista: MovimientoMensual[]) => new Map(lista.map((m) => [m.mes, m.total]));
    const altasIndexadas = porMes(altasPorMes);
    const bajasIndexadas = porMes(bajasPorMes);
    const movimientosMensuales = meses.map((mes) => ({
      mes,
      altas: altasIndexadas.get(mes) ?? 0,
      bajas: bajasIndexadas.get(mes) ?? 0,
    }));

    // Ingresos y gastos mes a mes. groupBy agrupa por fecha exacta, así que el
    // reparto por mes se hace aquí, sobre las sumas ya calculadas.
    const serieDinero = meses.map((mes) => {
      const delMes = transaccionesPorMes.filter((t) => claveMes(t.fecha) === mes);
      const suma = (tipo: TipoTransaccion) =>
        delMes.filter((t) => t.tipo === tipo).reduce((s, t) => s + Number(t._sum.importe ?? 0), 0);
      return { mes, ingresos: euros2(suma(TipoTransaccion.INGRESO)), gastos: euros2(suma(TipoTransaccion.GASTO)) };
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
      ejercicio,
      censo: {
        activos,
        altas12m,
        bajas12m,
        sinNumeroHermano,
        serieMensual: serieCenso,
        movimientosMensuales,
        porEdad,
      },
      dinero: {
        porEstado: recibosPorEstado.map((r) => ({
          estado: r.estado,
          total: r._count._all,
          importe: euros2(Number(r._sum.importe ?? 0)),
        })),
        devueltosPendientes: devueltosDelEjercicio,
        anterioresPorCobrar: {
          total: vivosAnteriores._count._all + devueltosAnteriores.total,
          importe: euros2(Number(vivosAnteriores._sum.importe ?? 0) + devueltosAnteriores.importe),
        },
        ejercicio: { anio, ingresos, gastos, saldo: euros2(ingresos - gastos) },
        serieMensual: serieDinero,
        porCategoria: transaccionesPorCategoria.map((t) => ({
          categoria: nombreCategoria.get(t.categoriaId) ?? 'Sin categoría',
          tipo: t.tipo,
          total: t._count._all,
          // En euros, que es lo que responde a «en qué se gasta»: el número de
          // apuntes no dice nada (una factura de 11.000 € y un recibo de 6 €
          // cuentan igual). `total` se mantiene para no romper a nadie.
          importe: euros2(Number(t._sum.importe ?? 0)),
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
      calendario: {
        mes: mesHoy,
        eventos: eventosDelMes.map((e) => ({ id: e.id, title: e.title, startDate: e.startDate.toISOString(), type: e.type })),
        diasDeReparto: [...new Set(turnosDelMes.map((t) => diaMadrid(t.fecha)))].sort(),
      },
      anio: {
        eventos: eventosDelAnio.map((e) => ({ id: e.id, title: e.title, startDate: e.startDate.toISOString(), type: e.type, location: e.location })),
      },
    };
  }
}
