import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs';

// Se lee del disco al cargar el módulo, no se importa: el fichero es de cada
// instalación (instalacion/datos-entidad.json, montado en el contenedor) y no
// viaja en la imagen. Si falta, la API no arranca y dice qué hacer.
const datos = leerDatosEntidad();

/**
 * Los datos de contacto del Grupo Parroquial que salen en los correos.
 *
 * Un dato a `null` está pendiente de confirmar y NO se sustituye por nada: el
 * bloque que lo contiene desaparece del correo. Es el mismo criterio que sigue
 * `desamparados-web/src/config/site.ts` con las páginas legales, y la razón es
 * la misma: un correo automático no se puede corregir una vez enviado, así que
 * es mejor que salga más corto a que mande a alguien a una calle inventada.
 *
 * Vive suelto y es puro para poder probar la decisión («¿se enseña este bloque
 * o no?») sin enviar ningún correo.
 */

interface DatosSecretaria {
  horario: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
}

/**
 * El artículo que concuerda con la corporación o con una salida: se guarda el
 * artículo y no el género porque hay corporaciones y salidas en plural (las
 * Cofradías Fusionadas, los Santos Oficios). Vive aquí y no en
 * `domain/articulos.ts` porque ese módulo necesita leer `identidad` (un valor)
 * de este fichero; si `Identidad` importara el tipo desde allí, el import
 * circular rompería la carga. `articulos.ts` lo reexporta.
 */
export type Articulo = 'el' | 'la' | 'los' | 'las';

/**
 * Quién es la corporación: nombre, tipo, advocación, localidad y dominio. Lo que
 * cambia de una instalación a otra vive en `instalacion/datos-entidad.json`, no
 * en el código, para poder montar la web para otra corporación sin tocarlo.
 */
export interface Identidad {
  nombre: string;
  nombreCorto: string;
  /** «Grupo Parroquial», «Hermandad»…: la papeleta lo pone encima de la advocación. */
  tipo: string;
  /** La misma clase sin el segundo sustantivo («Grupo», «Hermandad»): para frases ya situadas. */
  tipoCorto: string;
  /** El artículo que acompaña a `tipo` y `tipoCorto`. */
  articulo: Articulo;
  titular: string;
  localidad: string;
  dominio: string;
  descripcion: string;
}

// `as Identidad`: el JSON trae el artículo como `string`, no como el tipo
// literal `Articulo`, así que la asignación directa no compila.
export const identidad: Identidad = datos.identidad as Identidad;

const informado = (valor: string | null | undefined): valor is string =>
  typeof valor === 'string' && valor.trim() !== '';

/** Dónde está la corporación (`sede` del JSON), que es también donde atiende Secretaría. */
interface Sede {
  nombre: string | null;
  calle: string | null;
  codigoPostal: string | null;
  localidad: string | null;
}

/**
 * «C. Corregidor Paz Guzmán, 13, 29006 Málaga»: la sede en una línea. Sin la
 * calle no hay dirección (null, y el bloque desaparece del correo); sin
 * código postal o localidad, lo que haya.
 */
export function direccionDeLaSede(sede: Sede): string | null {
  if (!informado(sede.calle)) return null;
  const poblacion = [sede.codigoPostal, sede.localidad].filter(informado).map((v) => v.trim()).join(' ');
  return [sede.calle.trim(), poblacion].filter(Boolean).join(', ');
}

// La dirección de Secretaría sale de la sede: estaba escrita dos veces en el
// JSON, y cambiar una sin la otra dejaba los correos y el pie de la web
// mandando a sitios distintos.
export const secretaria: DatosSecretaria = { ...datos.secretaria, direccion: direccionDeLaSede(datos.sede) };

/**
 * Las líneas del bloque «Atención al Hermano», en el orden en que se pintan y
 * ya sin las que están pendientes. Lista vacía = no hay bloque que pintar.
 */
export function lineasDeSecretaria(datosSecretaria: DatosSecretaria = secretaria): string[] {
  return [datosSecretaria.horario, datosSecretaria.direccion, datosSecretaria.telefono]
    .filter(informado)
    .map((linea) => linea.trim());
}

/**
 * Dirección de la Secretaría para el pie de los correos. Cae en las variables
 * de entorno del contacto, que es de donde salen hoy los enlaces del pie.
 */
// El entorno llega de fuera para poder probarlo con uno inventado.
export function emailDeSecretaria(entorno: Readonly<Record<string, string | undefined>>): string | null {
  const candidatos = [secretaria.email, entorno.CONTACT_EMAIL_TO, entorno.EMAIL_USER];
  return candidatos.find(informado) ?? null;
}
