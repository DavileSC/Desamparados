/**
 * Filtros y resúmenes de la contabilidad del CMS, sin base de datos.
 *
 * El libro mayor y el resumen leen los mismos filtros (tipo, fechas, categoría,
 * método de pago y búsqueda) y los traducen al mismo `where`: así las cifras de
 * arriba de la pantalla cuadran siempre con la lista de abajo.
 */
import type { MetodoPago, Prisma, TipoRecibo, TipoTransaccion } from '@prisma/client';

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
  /** Solo los apuntes de este recibo: el enlace desde Tesorería. */
  recibo?: number;
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
  if (typeof query.desde === 'string' && esDiaValido(query.desde)) filtros.desde = query.desde;
  if (typeof query.hasta === 'string' && esDiaValido(query.hasta)) filtros.hasta = query.hasta;
  if (typeof query.categorias === 'string' && /^\d+(,\d+)*$/.test(query.categorias)) {
    filtros.categorias = query.categorias.split(',').map(Number);
  }
  if (typeof query.metodo === 'string' && (METODOS_PAGO as string[]).includes(query.metodo)) filtros.metodo = query.metodo as MetodoPago;
  if (typeof query.q === 'string' && query.q.trim()) filtros.q = query.q.trim();
  if (typeof query.recibo === 'string' && /^[1-9]\d{0,9}$/.test(query.recibo)) filtros.recibo = Number(query.recibo);
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

/**
 * Instante en que empieza ese día en Madrid.
 *
 * El desfase que cuenta es el de la propia medianoche de Madrid, no el de otra
 * hora del día: los días de cambio de hora, a mediodía ya rige el horario
 * nuevo y la medianoche salía una hora corrida (el 29-03-2026 empezaba a las
 * 23:00 del 28 en vez de a las 00:00). Madrid cambia a la 01:00 UTC, así que
 * entre su medianoche (22:00 o 23:00 UTC del día anterior) y las 00:00 UTC del
 * día nunca hay cambio: el desfase de las 00:00 UTC ya es el bueno. La segunda
 * pasada solo confirma, por si alguna vez la regla de la zona dejara de ser esa.
 */
export function inicioDiaMadrid(dia: string): Date {
  const [anio, mes, d] = dia.split('-').map(Number);
  const medianocheUtc = Date.UTC(anio, mes - 1, d);
  const tanteo = medianocheUtc - desfaseMadrid(new Date(medianocheUtc)) * 60000;
  return new Date(medianocheUtc - desfaseMadrid(new Date(tanteo)) * 60000);
}

/** El día de Madrid de un instante, en `AAAA-MM-DD`. */
export function diaMadrid(instante: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/**
 * El día de Madrid en que cae `instante`, como intervalo `[desde, hasta)` para
 * consultar con `gte`/`lt`. Para «hoy» no vale `setHours`: el servidor corre en
 * UTC y de medianoche a las 02:00 de Madrid seguía siendo el día anterior.
 * Los días de cambio de hora duran 23 o 25 horas, y así salen.
 */
export function diaMadridComoIntervalo(instante: Date): { desde: Date; hasta: Date } {
  const dia = diaMadrid(instante);
  const [anio, mes, d] = dia.split('-').map(Number);
  const siguiente = new Date(Date.UTC(anio, mes - 1, d + 1)).toISOString().slice(0, 10);
  return { desde: inicioDiaMadrid(dia), hasta: inicioDiaMadrid(siguiente) };
}

/**
 * ¿Es un día que existe en el calendario? El patrón `AAAA-MM-DD` deja pasar el
 * 2026-02-30, que `Date.UTC` convierte sin avisar en el 2 de marzo. Los años se
 * acotan a 1900-2100: por debajo de 100 `Date.UTC` los lee como 19xx, y un
 * «hasta» del año 9999 pedía una serie de ocho mil años.
 */
export function esDiaValido(dia: string): boolean {
  if (!FECHA.test(dia)) return false;
  const [anio, mes, d] = dia.split('-').map(Number);
  if (anio < 1900 || anio > 2100) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, d));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === d;
}

/** Un periodo al revés («desde» después de «hasta») no es un periodo vacío: es un error de quien lo pide. */
export function fechasInvertidas(filtros: Pick<FiltrosContables, 'desde' | 'hasta'>): boolean {
  return Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
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
  if (filtros.recibo) where.reciboId = filtros.recibo;
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

/** El mismo día un año antes. Sin 29 de febrero el año anterior, se queda en el 28. */
export function unAnioAntes(dia: string): string {
  const [anio, mes, d] = dia.split('-').map(Number);
  const ultimoDelMes = new Date(Date.UTC(anio - 1, mes, 0)).getUTCDate();
  return `${anio - 1}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimoDelMes)).padStart(2, '0')}`;
}

/** El mismo tramo un año antes, para comparar. Solo si el periodo tiene principio y fin. */
export function periodoAnterior(filtros: Pick<FiltrosContables, 'desde' | 'hasta'>): { desde: string; hasta: string } | null {
  if (!filtros.desde || !filtros.hasta) return null;
  return { desde: unAnioAntes(filtros.desde), hasta: unAnioAntes(filtros.hasta) };
}

function claveMadrid(instante: Date, gran: Granularidad): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: ZONA, year: 'numeric', month: '2-digit' }).formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return gran === 'anio' ? partes.year : `${partes.year}-${partes.month}`;
}

/** Mes de Madrid de un instante, `AAAA-MM`. Lo usa también el panel: los dos tienen que partir los meses igual. */
export const claveMesMadrid = (instante: Date): string => claveMadrid(instante, 'mes');

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
  // Un periodo al revés no tiene meses: sin esto el bucle no encontraba nunca
  // la clave final y salían 1.201 barras vacías hasta el tope.
  if (desde.getTime() > hasta.getTime()) return [];
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

// ==========================================
//  APUNTES MANUALES Y CATEGORÍAS
// ==========================================

/** Tope de la columna `importe`, que es Decimal(10,2): ocho cifras enteras y dos decimales. */
export const IMPORTE_MAXIMO = 99_999_999.99;

/**
 * Por qué no vale un importe, o `null` si vale. Pasarse del Decimal(10,2) daba
 * un 500 de la base de datos, y con tres decimales MariaDB redondeaba sin avisar:
 * 12,345 € se guardaba como 12,35 €.
 */
export function motivoImporteInvalido(importe: number): string | null {
  if (!Number.isFinite(importe) || importe <= 0) return 'tiene que ser mayor que cero';
  if (importe > IMPORTE_MAXIMO) return 'no puede pasar de 99.999.999,99 €';
  // Si al redondear a céntimos cambia, es que traía más de dos decimales. La
  // comparación es exacta: «12.34» y 1234 / 100 dan el mismo número en coma flotante.
  if (Math.round(importe * 100) / 100 !== importe) return 'no puede tener más de dos decimales';
  return null;
}

/** Por qué un apunte no puede llevar esa fecha, o `null`. La caja apunta lo que ya ha pasado. */
export function motivoFechaApunte(dia: string, ahora = new Date()): string | null {
  if (!esDiaValido(dia)) return 'no es un día válido';
  if (dia > diaMadrid(ahora)) return 'no puede ser posterior a hoy';
  return null;
}

/**
 * El instante que se guarda para un apunte de ese día. Si es hoy, la hora de
 * ahora: el libro, que ordena por fecha, lo pone encima de lo cobrado antes. Si
 * es otro día, su medianoche de Madrid, igual que los apuntes de la siembra: así
 * cae en su día y en su mes se mire con el filtro que se mire.
 */
export function instanteDelApunte(dia: string, ahora = new Date()): Date {
  return dia === diaMadrid(ahora) ? ahora : inicioDiaMadrid(dia);
}

/** El nombre de una categoría tal como se guarda: sin espacios de sobra. */
export const limpiarNombreCategoria = (nombre: string): string => nombre.trim().replace(/\s+/g, ' ');

/**
 * Clave para decidir si dos nombres de categoría son el mismo. Tiene que
 * coincidir con el índice único (tipo, nombre) de la base de datos, que compara
 * con la intercalación utf8mb4_unicode_ci: sin mayúsculas, sin tildes ni
 * diéresis, la ñ igual que la n y sin espacios al final. «Año» y «Ano» son la
 * misma categoría para MariaDB; si aquí fueran distintas, el servicio daría el
 * nombre por libre y la base respondería con un choque de clave sin explicación.
 * Los espacios de dentro se juntan (más estricto que la base, nunca menos).
 */
export function claveNombreCategoria(nombre: string): string {
  // NFD separa la letra de su marca (á → a + ´, ñ → n + ˜) y se quitan todas las marcas.
  return limpiarNombreCategoria(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');
}

/**
 * Dónde se apunta lo que entra por un recibo al cobrarse: una categoría por
 * tipo, para que Contabilidad distinga cuánto entra por cuotas, por papeletas
 * o por donativos. Los donativos van a la misma «Donativos» que los apuntes a
 * mano: son el mismo dinero, llegue con recibo o sin él.
 */
export const CATEGORIA_DE_RECIBO: Record<TipoRecibo, string> = {
  CUOTA_HERMANO: 'Cuotas de hermanos',
  PAPELETA_SITIO: 'Papeletas de sitio',
  DONATIVO: 'Donativos',
  OTRO: 'Otros recibos',
};
/** El reverso de un cobro que se devuelve. */
export const CATEGORIA_DEVOLUCIONES = 'Devoluciones de recibos';
/** Lo que cobra el banco por un recibo que devuelve. */
export const CATEGORIA_COMISIONES = 'Comisiones bancarias';

/**
 * Categorías que los recibos buscan por su nombre al cobrarse o devolverse
 * (recibos/comunes). Si se renombraran, el siguiente cobro crearía otra con el
 * nombre de siempre y el historial quedaría partido en dos.
 */
export const CATEGORIAS_DE_RECIBOS: readonly { nombre: string; tipo: TipoTransaccion }[] = [
  ...Object.values(CATEGORIA_DE_RECIBO).map((nombre) => ({ nombre, tipo: 'INGRESO' as const })),
  { nombre: CATEGORIA_DEVOLUCIONES, tipo: 'GASTO' },
  { nombre: CATEGORIA_COMISIONES, tipo: 'GASTO' },
];

export function esCategoriaDeRecibos(categoria: { nombre: string; tipo: TipoTransaccion }): boolean {
  const clave = claveNombreCategoria(categoria.nombre);
  return CATEGORIAS_DE_RECIBOS.some((c) => c.tipo === categoria.tipo && claveNombreCategoria(c.nombre) === clave);
}
