/**
 * Filtros y resúmenes de la contabilidad del CMS, sin base de datos.
 *
 * El libro mayor y el resumen leen los mismos filtros (tipo, fechas, categoría,
 * método de pago y búsqueda) y los traducen al mismo `where`: así las cifras de
 * arriba de la pantalla cuadran siempre con la lista de abajo.
 */
import type { MetodoPago, Prisma, TipoTransaccion } from '@prisma/client';

export const METODOS_PAGO: MetodoPago[] = ['EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION'];
const ZONA = 'Europe/Madrid';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export interface FiltrosContables {
  tipo?: TipoTransaccion;
  /** Día inicial, incluido (`AAAA-MM-DD`, calendario de Madrid). */
  desde?: string;
  /** Día final, incluido. */
  hasta?: string;
  categorias?: number[];
  metodo?: MetodoPago;
  q?: string;
}

export type Granularidad = 'mes' | 'anio';

export interface PuntoSerie {
  /** `AAAA-MM` por meses, `AAAA` por años. */
  clave: string;
  ingresos: number;
  gastos: number;
}

/** Lee los filtros de la consulta. Lo que no tiene forma de filtro se ignora. */
export function leerFiltros(query: Record<string, unknown>): FiltrosContables {
  const filtros: FiltrosContables = {};
  if (query.tipo === 'INGRESO' || query.tipo === 'GASTO') filtros.tipo = query.tipo;
  if (typeof query.desde === 'string' && FECHA.test(query.desde)) filtros.desde = query.desde;
  if (typeof query.hasta === 'string' && FECHA.test(query.hasta)) filtros.hasta = query.hasta;
  if (typeof query.categorias === 'string' && /^\d+(,\d+)*$/.test(query.categorias)) {
    filtros.categorias = query.categorias.split(',').map(Number);
  }
  if (typeof query.metodo === 'string' && (METODOS_PAGO as string[]).includes(query.metodo)) filtros.metodo = query.metodo as MetodoPago;
  if (typeof query.q === 'string' && query.q.trim()) filtros.q = query.q.trim();
  return filtros;
}

/** Minutos que Madrid va por delante de UTC en ese instante (60 en invierno, 120 en verano). */
function desfaseMadrid(instante: Date): number {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  const comoUtc = Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day), Number(partes.hour), Number(partes.minute));
  return Math.round((comoUtc - instante.getTime()) / 60000);
}

/** Instante en que empieza ese día en Madrid. */
export function inicioDiaMadrid(dia: string): Date {
  const [anio, mes, d] = dia.split('-').map(Number);
  const medianocheUtc = Date.UTC(anio, mes - 1, d);
  // El desfase se mira a mediodía para no caer en la hora que falta o sobra el día del cambio.
  return new Date(medianocheUtc - desfaseMadrid(new Date(medianocheUtc + 12 * 3600000)) * 60000);
}

/** El día siguiente, en `AAAA-MM-DD`. */
function diaSiguiente(dia: string): string {
  const [anio, mes, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, d + 1)).toISOString().slice(0, 10);
}

export function whereContable(filtros: FiltrosContables): Prisma.TransaccionWhereInput {
  const where: Prisma.TransaccionWhereInput = {};
  if (filtros.tipo) where.tipo = filtros.tipo;
  if (filtros.desde || filtros.hasta) {
    where.fecha = {
      ...(filtros.desde && { gte: inicioDiaMadrid(filtros.desde) }),
      // El hasta se incluye entero: se corta al empezar el día siguiente.
      ...(filtros.hasta && { lt: inicioDiaMadrid(diaSiguiente(filtros.hasta)) }),
    };
  }
  if (filtros.categorias?.length) where.categoriaId = { in: filtros.categorias };
  if (filtros.metodo) where.metodoPago = filtros.metodo;
  if (filtros.q) {
    // Cada palabra tiene que aparecer en algún sitio: «juan pérez» encuentra al
    // hermano aunque el nombre y los apellidos vivan en columnas distintas.
    // MariaDB compara sin distinguir mayúsculas con la intercalación por defecto.
    where.AND = filtros.q.split(/\s+/).map((palabra) => ({
      OR: [
        { concepto: { contains: palabra } },
        { hermano: { is: { nombre: { contains: palabra } } } },
        { hermano: { is: { apellidos: { contains: palabra } } } },
      ],
    }));
  }
  return where;
}

/** El mismo tramo un año antes, para comparar. Solo si el periodo tiene principio y fin. */
export function periodoAnterior(filtros: Pick<FiltrosContables, 'desde' | 'hasta'>): { desde: string; hasta: string } | null {
  if (!filtros.desde || !filtros.hasta) return null;
  const unAnioAntes = (dia: string) => {
    const [anio, mes, d] = dia.split('-').map(Number);
    // Sin 29 de febrero el año anterior, se queda en el 28.
    const ultimoDelMes = new Date(Date.UTC(anio - 1, mes, 0)).getUTCDate();
    return `${anio - 1}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimoDelMes)).padStart(2, '0')}`;
  };
  return { desde: unAnioAntes(filtros.desde), hasta: unAnioAntes(filtros.hasta) };
}

function claveMadrid(instante: Date, gran: Granularidad): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: ZONA, year: 'numeric', month: '2-digit' }).formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return gran === 'anio' ? partes.year : `${partes.year}-${partes.month}`;
}

/** Hasta 13 meses se ve mes a mes; con más, 57 barras no se leen y se pasa a años. */
export function granularidad(desde: Date, hasta: Date): Granularidad {
  const [a1, m1] = claveMadrid(desde, 'mes').split('-').map(Number);
  const [a2, m2] = claveMadrid(hasta, 'mes').split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + 1 <= 13 ? 'mes' : 'anio';
}

/**
 * Suma ingresos y gastos por mes o por año, con los huecos rellenos a cero
 * entre `desde` y `hasta`: un mes sin apuntes es un dato, no una barra que falta.
 */
export function agruparEnSerie(
  filas: { fecha: Date; tipo: TipoTransaccion; importe: number }[],
  gran: Granularidad,
  desde: Date,
  hasta: Date,
): PuntoSerie[] {
  const puntos = new Map<string, PuntoSerie>();
  let [anio, mes] = claveMadrid(desde, 'mes').split('-').map(Number);
  const fin = claveMadrid(hasta, gran);
  // Se recorre de mes en mes (o de año en año) hasta la clave final.
  for (;;) {
    const clave = gran === 'anio' ? String(anio) : `${anio}-${String(mes).padStart(2, '0')}`;
    puntos.set(clave, { clave, ingresos: 0, gastos: 0 });
    if (clave === fin || puntos.size > 1200) break;
    if (gran === 'anio') anio++;
    else if (mes === 12) { anio++; mes = 1; } else mes++;
  }
  for (const fila of filas) {
    const punto = puntos.get(claveMadrid(fila.fecha, gran));
    if (!punto) continue;
    if (fila.tipo === 'INGRESO') punto.ingresos += fila.importe;
    else punto.gastos += fila.importe;
  }
  // Céntimos exactos: sumar decimales en coma flotante deja colas como 120.50000001.
  return [...puntos.values()].map((p) => ({ ...p, ingresos: Math.round(p.ingresos * 100) / 100, gastos: Math.round(p.gastos * 100) / 100 }));
}
