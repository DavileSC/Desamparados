/**
 * El cortejo por antigüedad: en qué tramo va cada nazareno y en qué lugar.
 *
 * La costumbre: los hermanos más nuevos abren el cortejo y los más antiguos
 * van cerca del trono. Así que se ordena de más nuevo a más antiguo y se
 * reparte tramo a tramo, del primero (el de la cruz de guía) al último (el
 * del trono). Dentro de cada tramo, el número dice el lugar: el 1 va delante.
 *
 * Las plazas de cada tramo son el peso del reparto, no un tope: con menos
 * nazarenos que plazas, cada tramo se queda con su parte proporcional (ninguno
 * vacío mientras haya gente); con más, se reparten igual, en proporción. Así
 * el cortejo nunca deja un hueco delante ni amontona a los que sobran detrás.
 *
 * Solo entran los puestos que se reparten (los nazarenos, en la Pasión): el
 * trono, los acólitos o las mantillas van en su sitio y no se tocan.
 */

export interface Tramo {
  nombre: string;
  plazas: number;
}

export interface ConfiguracionCortejo {
  /** Del primero (el que abre) al último (junto al trono). */
  tramos: Tramo[];
  /** Los puestos que se reparten en los tramos, tal como se escriben en la papeleta. */
  puestos: string[];
}

export interface PapeletaDelCortejo {
  id: number;
  puesto: string;
  /** La antigüedad: fecha de alta en el Grupo ('AAAA-MM-DD'). */
  fechaAlta: string;
  numeroHermano: number | null;
  hermanoId: number;
}

interface Asignacion {
  papeletaId: number;
  tramo: string;
  numero: number;
}

const mismoPuesto = (a: string, b: string) =>
  a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** Los puestos sin vacíos ni repetidos (sin distinguir tildes ni mayúsculas): vale el primero. */
export function puestosSinRepetir(puestos: string[]): string[] {
  const vistos: string[] = [];
  for (const p of puestos.map((x) => x.trim()).filter(Boolean)) if (!vistos.some((v) => mismoPuesto(v, p))) vistos.push(p);
  return vistos;
}

/** ¿Se reparte en los tramos este puesto? Sin distinguir tildes ni mayúsculas. */
export const seReparte = (config: ConfiguracionCortejo, puesto: string) => config.puestos.some((p) => mismoPuesto(p, puesto));

/**
 * Cuántos van a cada tramo: `total` repartido en proporción a las plazas, por
 * el método del resto mayor (la cuenta de los escaños). Con empate de restos,
 * gana el tramo de más atrás: el que sobra, mejor junto al trono.
 */
export function cuantosPorTramo(plazas: number[], total: number): number[] {
  const suma = plazas.reduce((s, p) => s + p, 0);
  if (suma <= 0 || total <= 0) return plazas.map(() => 0);
  const exactos = plazas.map((p) => (p * total) / suma);
  const cuantos = exactos.map(Math.floor);
  let quedan = total - cuantos.reduce((s, c) => s + c, 0);
  const porResto = exactos.map((e, i) => ({ i, resto: e - Math.floor(e) })).sort((a, b) => b.resto - a.resto || b.i - a.i);
  for (const { i } of porResto) {
    if (quedan === 0) break;
    cuantos[i] += 1;
    quedan -= 1;
  }
  return cuantos;
}

/**
 * Más nuevo primero: alta más reciente; a igual alta, número más alto (sin
 * número todavía cuenta como el más nuevo: aún no lo han numerado); y el id,
 * para que el orden no baile entre dos repartos.
 */
function deMasNuevoAMasAntiguo(a: PapeletaDelCortejo, b: PapeletaDelCortejo): number {
  if (a.fechaAlta !== b.fechaAlta) return a.fechaAlta < b.fechaAlta ? 1 : -1;
  const na = a.numeroHermano ?? Number.MAX_SAFE_INTEGER;
  const nb = b.numeroHermano ?? Number.MAX_SAFE_INTEGER;
  if (na !== nb) return nb - na;
  return b.hermanoId - a.hermanoId;
}

export function repartirCortejo(config: ConfiguracionCortejo, papeletas: PapeletaDelCortejo[]): {
  asignaciones: Asignacion[];
  tramos: { nombre: string; plazas: number; asignados: number }[];
  /** Papeletas de puestos que no se reparten: se quedan como están. */
  fuera: number;
} {
  const entran = papeletas.filter((p) => seReparte(config, p.puesto)).sort(deMasNuevoAMasAntiguo);
  const cuantos = cuantosPorTramo(config.tramos.map((t) => t.plazas), entran.length);
  const asignaciones: Asignacion[] = [];
  let i = 0;
  config.tramos.forEach((tramo, t) => {
    for (let numero = 1; numero <= cuantos[t]; numero++) {
      asignaciones.push({ papeletaId: entran[i].id, tramo: tramo.nombre, numero });
      i += 1;
    }
  });
  return {
    asignaciones,
    tramos: config.tramos.map((t, k) => ({ nombre: t.nombre, plazas: t.plazas, asignados: cuantos[k] })),
    fuera: papeletas.length - entran.length,
  };
}

/**
 * El cortejo de una salida cuyo `cortejo` es null, porque el Grupo aún no
 * ha dicho nada: cuatro tramos iguales con todos los puestos de la salida.
 * Con los suyos y no con «Nazareno»: una salida de acompañantes no tiene
 * nazarenos, y proponerlos dejaba el reparto sin nadie a quien repartir.
 */
export function cortejoPorDefecto(puestos: readonly { nombre: string }[]): ConfiguracionCortejo {
  return {
    tramos: [1, 2, 3, 4].map((n) => ({ nombre: `Tramo ${n}`, plazas: 30 })),
    puestos: puestosSinRepetir(puestos.map((p) => p.nombre)),
  };
}

/** `null` si la configuración vale; si no, por qué. */
export function problemaConfiguracion(config: ConfiguracionCortejo): string | null {
  if (config.tramos.length === 0) return 'Hace falta al menos un tramo.';
  const nombres = config.tramos.map((t) => t.nombre.trim().toLowerCase());
  if (nombres.some((n) => !n)) return 'Cada tramo necesita un nombre.';
  if (new Set(nombres).size !== nombres.length) return 'Hay dos tramos con el mismo nombre.';
  if (config.tramos.some((t) => !Number.isInteger(t.plazas) || t.plazas < 1)) return 'Cada tramo necesita al menos una plaza.';
  if (config.puestos.length === 0) return 'Elige al menos un puesto que se reparta en los tramos.';
  return null;
}
