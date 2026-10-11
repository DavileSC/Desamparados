/**
 * Los apellidos de una ficha se guardan de dos maneras: cada uno por separado
 * (`primerApellido`, `segundoApellido`) y los dos juntos (`apellidos`), que es
 * con lo que se busca, se ordena y se enseña en todas partes.
 *
 * `apellidos` lo escribe siempre el servidor a partir de los dos sueltos: si
 * cada formulario lo compusiera a su manera, acabarían diciendo cosas
 * distintas.
 */

interface Apellidos {
  apellidos: string;
  primerApellido: string | null;
  segundoApellido: string | null;
}

const limpio = (valor: string | null | undefined) => {
  const texto = (valor ?? '').replace(/\s+/g, ' ').trim();
  return texto === '' ? null : texto;
};

/** «Benítez» y «Salas» → «Benítez Salas». Sin segundo apellido, solo el primero. */
export function componerApellidos(primero: string | null | undefined, segundo: string | null | undefined): Apellidos {
  const p = limpio(primero);
  const s = limpio(segundo);
  return { apellidos: [p, s].filter(Boolean).join(' '), primerApellido: p, segundoApellido: s };
}

/**
 * Para quien manda los apellidos juntos, como hacían los formularios de antes.
 * Con exactamente dos palabras hay uno en cada sitio; con más («de la Vega
 * Ruiz») no se sabe dónde acaba el primero, y van enteros al primero. La misma
 * regla que usó la migración con las fichas que ya había.
 */
export function partirApellidos(juntos: string | null | undefined): Apellidos {
  const texto = limpio(juntos);
  if (!texto) return { apellidos: '', primerApellido: null, segundoApellido: null };
  const palabras = texto.split(' ');
  return palabras.length === 2
    ? componerApellidos(palabras[0], palabras[1])
    : { apellidos: texto, primerApellido: texto, segundoApellido: null };
}

/**
 * Los apellidos que debe quedar en la ficha tras un cambio. Manda lo que llega
 * por separado; lo que no llega se toma de la ficha (`actual`). Si solo llegan
 * juntos, se parten. `null` = no se tocan (tampoco si llegan vacíos).
 */
export function apellidosTrasCambio(
  cambios: { apellidos?: unknown; primerApellido?: unknown; segundoApellido?: unknown },
  actual: { apellidos?: string | null; primerApellido?: string | null; segundoApellido?: string | null } = {},
): Apellidos | null {
  const traePartes = cambios.primerApellido !== undefined || cambios.segundoApellido !== undefined;
  if (traePartes) {
    return componerApellidos(
      cambios.primerApellido !== undefined ? (cambios.primerApellido as string | null) : actual.primerApellido,
      cambios.segundoApellido !== undefined ? (cambios.segundoApellido as string | null) : actual.segundoApellido,
    );
  }
  // Vacíos cuentan como no traídos: el alta de un hijo hereda los del adulto.
  // Los mismos de siempre (un formulario viejo manda la ficha entera): no se
  // tocan, o una ficha con los apellidos bien partidos a mano se volvería a partir.
  if (typeof cambios.apellidos === 'string' && cambios.apellidos.trim() !== '') {
    const juntos = partirApellidos(cambios.apellidos);
    return juntos.apellidos === partirApellidos(actual.apellidos).apellidos ? null : juntos;
  }
  return null;
}
