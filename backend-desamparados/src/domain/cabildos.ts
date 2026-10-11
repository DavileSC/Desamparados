/**
 * Las reglas de los cabildos: quién tiene voto, cuándo hay quórum y qué sale
 * de cada votación. Puras: las fechas llegan como 'AAAA-MM-DD'.
 *
 * Lo que cambia de unas reglas a otras (la edad, la antigüedad para votar, el
 * quórum de la primera convocatoria) va en la configuración, con estos valores
 * por defecto, los habituales en las reglas de las corporaciones.
 */

export interface ReglasCabildo {
  /** Años cumplidos el día del cabildo para tener voto. */
  edadMinima: number;
  /** Años de antigüedad en el Grupo el día del cabildo para tener voto. */
  antiguedadMinima: number;
  /** Porcentaje del censo con voto que tiene que estar en primera convocatoria (más de). */
  quorumPrimera: number;
}

export const REGLAS_POR_DEFECTO: ReglasCabildo = { edadMinima: 18, antiguedadMinima: 1, quorumPrimera: 50 };

/** El mismo día, `anios` años antes. El 29 de febrero, en un año que no lo tiene, pasa al 28. */
export function aniosAntes(dia: string, anios: number): string {
  const anio = Number(dia.slice(0, 4)) - anios;
  const mesDia = dia.slice(5);
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  return `${anio}-${mesDia === '02-29' && !bisiesto ? '02-28' : mesDia}`;
}

/**
 * Hasta qué fechas de nacimiento y de alta se tiene voto en un cabildo: quien
 * nació ese día o antes y se dio de alta ese día o antes.
 */
export function limitesDelVoto(diaCabildo: string, reglas: ReglasCabildo): { nacidoHasta: string; altaHasta: string } {
  return { nacidoHasta: aniosAntes(diaCabildo, reglas.edadMinima), altaHasta: aniosAntes(diaCabildo, reglas.antiguedadMinima) };
}

export function tieneVoto(h: { activo: boolean; fechaNacimiento: string; fechaAlta: string }, diaCabildo: string, reglas: ReglasCabildo): boolean {
  const { nacidoHasta, altaHasta } = limitesDelVoto(diaCabildo, reglas);
  return h.activo && h.fechaNacimiento <= nacidoHasta && h.fechaAlta <= altaHasta;
}

/**
 * El quórum: en primera convocatoria, más del porcentaje del censo con voto;
 * en segunda, basta con los presentes. `necesarios` es cuántos con voto
 * tienen que estar para la primera.
 */
export function quorum(presentesConVoto: number, censoConVoto: number, reglas: ReglasCabildo): {
  necesarios: number;
  enPrimera: boolean;
} {
  const necesarios = Math.floor((censoConVoto * reglas.quorumPrimera) / 100) + 1;
  return { necesarios, enPrimera: censoConVoto > 0 && presentesConVoto >= necesarios };
}

type ResultadoVotacion = 'APROBADO' | 'RECHAZADO';

/**
 * Qué sale de una votación. La simple, más a favor que en contra (el empate
 * no aprueba). La de dos tercios, dos tercios de los votos emitidos: las
 * abstenciones no cuentan como emitidos.
 */
export function resultado(v: { aFavor: number; enContra: number; mayoria: 'SIMPLE' | 'DOS_TERCIOS' }): ResultadoVotacion {
  if (v.mayoria === 'DOS_TERCIOS') {
    const emitidos = v.aFavor + v.enContra;
    return emitidos > 0 && v.aFavor * 3 >= emitidos * 2 ? 'APROBADO' : 'RECHAZADO';
  }
  return v.aFavor > v.enContra ? 'APROBADO' : 'RECHAZADO';
}

/** `null` si el recuento cabe en los presentes con voto; si no, por qué. */
export function problemaRecuento(v: { aFavor: number; enContra: number; abstenciones: number }, presentesConVoto: number): string | null {
  const total = v.aFavor + v.enContra + v.abstenciones;
  if (total === 0) return 'La votación no tiene ningún voto.';
  if (total > presentesConVoto) return `Hay ${total} votos y solo ${presentesConVoto === 1 ? 'hay 1 hermano presente con voto' : `${presentesConVoto} hermanos presentes con voto`}.`;
  return null;
}
