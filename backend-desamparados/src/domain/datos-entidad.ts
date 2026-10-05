import datos from '../../../shared/datos-entidad.json' with { type: 'json' };

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

export interface DatosSecretaria {
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
 * cambia de una instalación a otra vive en `shared/datos-entidad.json`, no en
 * el código, para poder montar la web para otra corporación sin tocarlo.
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

// `as Identidad`: el import JSON no estrecha "el" al tipo literal `Articulo`,
// solo a `string`, así que la asignación directa no compila.
export const identidad: Identidad = datos.identidad as Identidad;

export const secretaria: DatosSecretaria = datos.secretaria;

export const escudoUrl: string | null = datos.escudoUrl;

const informado = (valor: string | null | undefined): valor is string =>
  typeof valor === 'string' && valor.trim() !== '';

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
// El entorno llega siempre de fuera y sin los tipos de Node: este módulo lo
// importa también la web (por la política de contraseñas), y en su imagen de
// Docker no hay tipos de Node con los que compilar `process`.
export function emailDeSecretaria(entorno: Readonly<Record<string, string | undefined>>): string | null {
  const candidatos = [secretaria.email, entorno.CONTACT_EMAIL_TO, entorno.EMAIL_USER];
  return candidatos.find(informado) ?? null;
}
