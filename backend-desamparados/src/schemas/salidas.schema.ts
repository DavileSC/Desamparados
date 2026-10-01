import { type } from 'arktype';
import { idParam } from '../config/common.js';

/**
 * Las salidas procesionales, tal como las edita el CMS: ver
 * `services/procesion/salidas.service.ts`. La fecha a mano no se valida aquí,
 * va por su propia ruta (`fechaDeSalidaSchema`): fijarla crea o mueve el acto
 * de la Agenda, que es una operación distinta de editar la fila.
 */

// El slug entra en la URL y en consultas (`?salida=<slug>`): minúsculas y
// guiones, sin empezar ni terminar por uno ni dejar dos seguidos.
const slug = type('string').matching(/^[a-z0-9]+(-[a-z0-9]+)*$/).describe('un slug en minúsculas, con palabras separadas por guiones');

// Un puesto del catálogo de la salida (PuestoDelCatalogo, domain/salidas.ts).
const puesto = type({
  nombre: 'string > 0',
  tunica: 'boolean',
  tocado: "'CAPIROTE' | 'FARAONA' | null",
  alturaHombro: 'boolean',
});

/** Lo que se edita de una salida. La fecha a mano va por su ruta: crea el acto de la Agenda. */
const datosSalida = type({
  nombre: '0 < string <= 120',
  slug,
  orden: 'number.integer >= 0',
  activa: 'boolean',
  conRopa: 'boolean',
  cobro: "'CUOTA' | 'DONATIVO'",
  importeCuota: '0 <= number <= 9999',
  fecha: "'PASCUA' | 'MANUAL'",
  diasDesdePascua: '-60 <= number.integer <= 60 | null',
  horaSalida: 'string <= 40 | null',
  lugar: 'string <= 191 | null',
  puestos: puesto.array().atLeastLength(1),
  indicaciones: 'string <= 2000 | null',
});

export const crearSalidaSchema = type({ body: datosSalida });
export const editarSalidaSchema = type({ params: { id: idParam }, body: datosSalida.partial() });
export const fechaDeSalidaSchema = type({
  params: { id: idParam },
  body: { inicio: 'string > 0', 'lugar?': 'string | null' },
});
