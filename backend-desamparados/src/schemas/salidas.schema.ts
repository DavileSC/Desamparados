import { type } from 'arktype';
import { idParam } from '../config/common.js';
import { puesto as nombreDePuesto } from './procesion.schema.js';

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
// Su nombre, con la misma regla con la que el hermano lo pide en la solicitud.
const puesto = type({
  nombre: nombreDePuesto,
  tunica: 'boolean',
  tocado: "'CAPIROTE' | 'FARAONA' | null",
  alturaHombro: 'boolean',
});

// Sin «<» ni «>»: estos textos acaban en correos y en la papeleta.
const sinEtiquetas = (max: number) => type(`string <= ${max}`).matching(/^[^<>]*$/).describe(`un texto de ${max} caracteres como mucho, sin «<» ni «>»`);
// El lugar acaba en `Evento.location` (191 como mucho) en las de fecha a
// mano: 160, como tenía la fecha del Rosario, deja margen.
const lugar = sinEtiquetas(160).or('null');

/** Lo que se edita de una salida. La fecha a mano va por su ruta: crea el acto de la Agenda. */
const datosSalida = type({
  nombre: type('0 < string <= 120').matching(/^[^<>]+$/).describe('un nombre de 120 caracteres como mucho, sin «<» ni «>»'),
  slug,
  // «el Sábado de Pasión», «la Procesión Magna»: con qué se escribe «del» o «de la» (domain/articulos.ts).
  articulo: "'el' | 'la' | 'los' | 'las'",
  orden: 'number.integer >= 0',
  activa: 'boolean',
  conRopa: 'boolean',
  cobro: "'CUOTA' | 'DONATIVO'",
  importeCuota: '0 <= number <= 9999',
  fecha: "'PASCUA' | 'MANUAL'",
  diasDesdePascua: '-60 <= number.integer <= 60 | null',
  horaSalida: sinEtiquetas(40).or('null'),
  lugar,
  // Como mucho 20: el cortejo por defecto propone todos los puestos de la
  // salida, y guardar el cortejo admite 20 (`cortejoConfiguracionSchema`).
  puestos: puesto.array().atLeastLength(1).atMostLength(20),
  indicaciones: sinEtiquetas(2000).or('null'),
});

export const crearSalidaSchema = type({ body: datosSalida });
export const editarSalidaSchema = type({ params: { id: idParam }, body: datosSalida.partial() });
export const fechaDeSalidaSchema = type({
  params: { id: idParam },
  body: { inicio: 'string > 0', 'lugar?': lugar },
});
