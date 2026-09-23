import catalogo from '../../../shared/puestos-procesion.json' with { type: 'json' };

/**
 * Reglas de la mesa de la procesión que no necesitan base de datos: la altura
 * de hombro tal como la dicta quien talla, la talla que lleva escrita el
 * número de una túnica y qué ropa proponer a quien vuelve un año más.
 */

export type Tocado = 'CAPIROTE' | 'FARAONA';
export type Origen = 'ROPERO' | 'PROPIA' | 'NINGUNA';

export interface PuestoDelCatalogo {
  nombre: string;
  tunica: boolean;
  tocado: Tocado | null;
  alturaHombro: boolean;
}

/** Los puestos que sugiere la mesa (shared/puestos-procesion.json). */
export const PUESTOS: readonly PuestoDelCatalogo[] = catalogo.puestos as PuestoDelCatalogo[];

/** Lo que hace el tallaje al hombro razonable: ni un niño ni un error de tecleo. */
const ALTURA_MINIMA_CM = 100;
const ALTURA_MAXIMA_CM = 220;

/**
 * La altura de hombro en centímetros. Quien talla la dicta en metros («1,45»,
 * «1.5») y la ficha la guarda en centímetros (145); se aceptan las dos
 * formas. `null` si no se entiende o se sale de lo razonable.
 */
export function alturaHombroEnCm(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.').replace(/\s*(m|cm)$/i, '');
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(limpio)) return null;
  const valor = Number(limpio);
  const cm = valor < 3 ? Math.round(valor * 100) : Math.round(valor);
  return cm >= ALTURA_MINIMA_CM && cm <= ALTURA_MAXIMA_CM ? cm : null;
}

/**
 * La talla que lleva escrita una túnica numerada como «145-31»: la parte de
 * antes del guion (el largo, en centímetros). `null` si el número no sigue
 * esa forma.
 */
export function tallaDeTunica(numero: string): string | null {
  const partes = /^(\d{2,3})\s*-\s*\S+$/.exec(numero.trim());
  return partes ? partes[1] : null;
}

/** Un número de prenda tal como se guarda: sin espacios y en mayúsculas («21m» → «21M»). */
export function normalizarNumeroPrenda(numero: string): string {
  return numero.trim().replace(/\s+/g, '').toUpperCase();
}

export interface PapeletaAnterior {
  puesto: string;
  numTunicaAsignada: string | null;
  numCapiroteAsignado: string | null;
  numFaraonaAsignada: string | null;
  origenTunica: Origen | null;
}

export interface Propuesta {
  puesto: string;
  tunica: { origen: Origen; numero: string | null };
  capirote: string | null;
  faraona: string | null;
}

/**
 * Qué ropa proponer a quien llega a la mesa. Primero, lo que ya tiene
 * prestado del ropero (se la llevó a casa y la trae); si no, lo que llevó la
 * última vez; si nunca salió, túnica propia si su ficha lo dice. La mesa lo
 * ve rellenado y cambia lo que haga falta.
 */
export function propuestaDeRopa(entrada: {
  anterior: PapeletaAnterior | null;
  prestadas: { tipo: string; numero: string }[];
  tieneTunicaPropia: boolean;
  puestoDeLaFicha: string | null;
}): Propuesta {
  const { anterior, prestadas, tieneTunicaPropia, puestoDeLaFicha } = entrada;
  const prestada = (tipo: string) => prestadas.find((p) => p.tipo === tipo)?.numero ?? null;

  let tunica: Propuesta['tunica'];
  const tunicaEnCasa = prestada('TUNICA');
  if (tunicaEnCasa) tunica = { origen: 'ROPERO', numero: tunicaEnCasa };
  else if (anterior?.origenTunica === 'PROPIA' || (!anterior?.numTunicaAsignada && tieneTunicaPropia)) tunica = { origen: 'PROPIA', numero: null };
  else if (anterior?.origenTunica === 'NINGUNA') tunica = { origen: 'NINGUNA', numero: null };
  else tunica = { origen: 'ROPERO', numero: anterior?.numTunicaAsignada ?? null };

  return {
    puesto: anterior?.puesto ?? puestoDeLaFicha ?? '',
    tunica,
    capirote: prestada('CAPIROTE') ?? anterior?.numCapiroteAsignado ?? null,
    faraona: prestada('FARAONA') ?? anterior?.numFaraonaAsignada ?? null,
  };
}

/**
 * Si la papeleta paga el alquiler de túnica. Con la mesa, lo decide de dónde
 * sale la túnica: solo la del ropero se alquila (propia o ninguna, como una
 * mantilla, no pagan). Sin origen —la inscripción de antes— manda la ficha.
 */
export function pagaAlquiler(origen: Origen | undefined, tieneTunicaPropia: boolean): boolean {
  return origen ? origen === 'ROPERO' : !tieneTunicaPropia;
}
