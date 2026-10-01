/**
 * Reglas de la mesa de la procesión que no necesitan base de datos: la altura
 * de hombro tal como la dicta quien talla, la talla que lleva escrita el
 * número de una túnica y qué ropa proponer a quien vuelve un año más.
 */

export type Tocado = 'CAPIROTE' | 'FARAONA';
export type Origen = 'ROPERO' | 'PROPIA' | 'NINGUNA';

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

/** Qué se propone con el cíngulo (la mesa lo cambia a «se le debe» si no quedan). */
export type CinguloPropuesto = 'PRESTADO' | 'PROPIO' | 'NINGUNO';

export interface Propuesta {
  puesto: string;
  /** `porTalla`: no tenía una en casa ni estaba libre la de antes; esta la elige su altura al hombro. */
  tunica: { origen: Origen; numero: string | null; porTalla?: boolean };
  capirote: string | null;
  faraona: string | null;
  cingulo: CinguloPropuesto;
}

/** El cíngulo va con la túnica: del ropero, se presta; propia, lleva el suyo; sin túnica, ninguno. */
export const CINGULO_SEGUN_TUNICA: Record<Origen, CinguloPropuesto> = { ROPERO: 'PRESTADO', PROPIA: 'PROPIO', NINGUNA: 'NINGUNO' };

/** Una túnica libre del ropero: su número y la talla que tenga apuntada, si la tiene. */
export interface TunicaLibre { numero: string; talla: string | null }

/**
 * Cuánto puede alejarse la talla de una túnica de la altura al hombro para
 * proponerla. Más larga se recoge con el cíngulo; más corta enseña el tobillo,
 * así que por abajo se admite menos.
 */
export const HOLGURA_TUNICA_CM = { masLarga: 5, masCorta: 3 };

/** La talla de una túnica en centímetros: la de su número («145-31») o, si no, la apuntada («1,45»). */
export function tallaEnCm(t: TunicaLibre): number | null {
  const delNumero = tallaDeTunica(t.numero);
  if (delNumero) return Number(delNumero);
  return t.talla ? alturaHombroEnCm(t.talla) : null;
}

/**
 * La túnica libre que mejor le va a una altura al hombro: la de talla más
 * cercana dentro de la holgura y, a igual distancia, la más larga. Null si
 * no hay ninguna de su talla (o no se sabe su altura): entonces la mesa busca.
 */
export function tunicaParaSuTalla(alturaCm: number | null, libres: TunicaLibre[]): TunicaLibre | null {
  if (!alturaCm) return null;
  let mejor: { t: TunicaLibre; talla: number } | null = null;
  for (const t of libres) {
    const talla = tallaEnCm(t);
    if (talla === null) continue;
    const diferencia = talla - alturaCm;
    if (diferencia > HOLGURA_TUNICA_CM.masLarga || -diferencia > HOLGURA_TUNICA_CM.masCorta) continue;
    const distancia = Math.abs(diferencia);
    const actual = mejor && Math.abs(mejor.talla - alturaCm);
    if (!mejor || actual === null || distancia < actual || (distancia === actual && talla > mejor.talla)) mejor = { t, talla };
  }
  return mejor?.t ?? null;
}

/**
 * Qué ropa proponer a quien llega a la mesa. Primero, lo que tenga sin
 * devolver del ropero (lo trae y se le vuelve a dar); si no, lo que llevó
 * la última vez, que ya estará lavado; si nunca salió, túnica propia si su
 * ficha lo dice. El cíngulo, según la túnica. La mesa lo ve rellenado y
 * cambia lo que haga falta.
 */
export function propuestaDeRopa(entrada: {
  anterior: PapeletaAnterior | null;
  prestadas: { tipo: string; numero: string }[];
  tieneTunicaPropia: boolean;
  puestoDeLaFicha: string | null;
  /**
   * Las túnicas libres del ropero y su altura al hombro. Con ellas, si va del
   * ropero sin túnica en casa y la de antes ya no está libre (o nunca tuvo),
   * se le propone la de su talla. Sin ellas, como siempre.
   */
  ropero?: { libres: TunicaLibre[]; alturaHombro: number | null };
}): Propuesta {
  const { anterior, prestadas, tieneTunicaPropia, puestoDeLaFicha, ropero } = entrada;
  const prestada = (tipo: string) => prestadas.find((p) => p.tipo === tipo)?.numero ?? null;

  let tunica: Propuesta['tunica'];
  const tunicaEnCasa = prestada('TUNICA');
  if (tunicaEnCasa) tunica = { origen: 'ROPERO', numero: tunicaEnCasa };
  else if (anterior?.origenTunica === 'PROPIA' || (!anterior?.numTunicaAsignada && tieneTunicaPropia)) tunica = { origen: 'PROPIA', numero: null };
  else if (anterior?.origenTunica === 'NINGUNA') tunica = { origen: 'NINGUNA', numero: null };
  else tunica = { origen: 'ROPERO', numero: anterior?.numTunicaAsignada ?? null };

  const anteriorLibre = tunica.numero !== null && ropero?.libres.some((t) => t.numero === tunica.numero);
  if (ropero && tunica.origen === 'ROPERO' && !tunicaEnCasa && !anteriorLibre) {
    const deSuTalla = tunicaParaSuTalla(ropero.alturaHombro, ropero.libres);
    // Sin ninguna de su talla, se deja la de antes (la mesa verá que no está libre) o el hueco.
    if (deSuTalla) tunica = { origen: 'ROPERO', numero: deSuTalla.numero, porTalla: true };
  }

  return {
    puesto: anterior?.puesto ?? puestoDeLaFicha ?? '',
    tunica,
    capirote: prestada('CAPIROTE') ?? anterior?.numCapiroteAsignado ?? null,
    faraona: prestada('FARAONA') ?? anterior?.numFaraonaAsignada ?? null,
    cingulo: CINGULO_SEGUN_TUNICA[tunica.origen],
  };
}
