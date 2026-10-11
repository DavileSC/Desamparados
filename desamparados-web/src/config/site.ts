/**
 * Datos identificativos de la entidad.
 *
 * Punto único de verdad para el aviso legal, la politica de privacidad, la de
 * cookies y el pie de página. Los campos que el Grupo Parroquial todavía no ha
 * confirmado valen `null`: las páginas legales detectan ese `null` y muestran
 * el aviso de "pendiente de confirmar" en su lugar, de modo que al rellenar
 * este fichero el aviso desaparece solo y no queda ningún dato inventado
 * publicado.
 *
 * Obligatorios antes de publicar (art. 10 LSSI-CE y art. 13 RGPD):
 * `denominacion`, `domicilio` y un canal de contacto del responsable.
 *
 * El NIF no está aquí a propósito: el Grupo Parroquial no quiere publicarlo
 * (28-09-2026), y todo lo de este fichero acaba en el código de la web.
 */
import ENTIDAD from '@instalacion/datos-entidad.json'


/**
 * Quién es la corporación y cómo se la contacta: vive en
 * `instalacion/datos-entidad.json`, que lee también la API (correos, PDF). Montar la
 * web para otra corporación empieza por ese fichero, no por el código.
 */
const { identidad, secretaria, sede, redes, privacidad } = ENTIDAD

/** Lo que se busca en Google Maps para llegar: la sede con su calle y su localidad. */
const busquedaDeLaSede = [sede.nombre, sede.calle, sede.localidad].filter(Boolean).join(', ')

export const site = {
  /** Nombre comercial con el que se identifica la web. */
  nombre: identidad.nombre,
  /** El de las pestañas del navegador y el rótulo de la barra. */
  nombreCorto: identidad.nombreCorto,
  /** La clase de corporación suelta, para un rótulo o una versalita («Grupo Parroquial», «Hermandad»). Con artículo, domain/articulos.ts. */
  tipo: identidad.tipo,
  /** La misma clase, corta y sin el segundo sustantivo, para un rótulo ya situado («Datos del Grupo»). */
  tipoCorto: identidad.tipoCorto,
  /** La advocación: pies de foto y textos alternativos. */
  titular: identidad.titular,
  /** La dirección de la web pública, sin barra al final. */
  url: `https://${identidad.dominio}`,
  descripcion: identidad.descripcion,

  entidad: {
    /** Denominación jurídica exacta inscrita. */
    denominacion: identidad.denominacion,
    /** Domicilio social completo (vía, número, CP y municipio). */
    domicilio: identidad.domicilio,
    /** Localidad conocida, usable mientras no haya domicilio completo. */
    localidad: identidad.localidad,
  },

  // Los de Secretaría, los mismos que firman los correos de la API.
  contacto: {
    email: secretaria.email ?? '',
    /** Teléfono oficial, el mismo que el de Secretaría. */
    telefono: secretaria.telefono,
    /** El de Secretaría: los textos del alta lo citan entre paréntesis, en minúscula. */
    horario: secretaria.horario ?? '',
  },

  /**
   * Dónde está el Grupo Parroquial, para quien quiere ir: el pie de página. No
   * es el domicilio social de `entidad`, que es un dato legal. Sale del mismo
   * JSON que el JSON-LD de index.html, para no escribir la calle dos veces.
   */
  sede: {
    nombre: sede.nombre,
    direccion: sede.calle,
    localidad: sede.localidad,
    /** Abre Google Maps en otra pestaña con la sede buscada. */
    comoLlegar: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busquedaDeLaSede)}`,
    /** El mapa del pie: la misma búsqueda, incrustada (sin clave de la API de Google). */
    mapa: `https://www.google.com/maps?q=${encodeURIComponent(busquedaDeLaSede)}&output=embed`,
  },

  /** Canal para ejercer los derechos RGPD. Cae al email general si no hay uno propio. */
  privacidad: {
    emailDerechos: privacidad.emailDerechos,
  },

  /**
   * Perfiles oficiales. Un `null` significa que el Grupo Parroquial todavía no ha
   * facilitado la URL: la interfaz oculta ese enlace en vez de publicar uno
   * muerto que lleve a `#`.
   */
  redes,

  /** Retransmisión en directo desde la sede. `null` si no hay stream publicado. */
  directo: {
    urlAlternativa: null as string | null,
  },

  /** Las normas o estatutos por los que se rige, que enlaza el aviso legal ({ titulo, url }), o null. */
  normas: identidad.normas,
} as const

/** Texto a mostrar cuando un dato legal obligatorio aún no está confirmado. */
export const DATO_PENDIENTE = 'pendiente de confirmar'

/** Devuelve el valor si está informado, o el aviso de pendiente. */
export function legal(valor: string | null): string {
  return valor ?? DATO_PENDIENTE
}

/** `true` si falta algún dato identificativo exigido por la LSSI/RGPD. */
export const faltanDatosIdentificativos =
  site.entidad.denominacion === null ||
  site.entidad.domicilio === null

/** Canal de contacto para ejercer derechos RGPD. */
export const emailDerechos = site.privacidad.emailDerechos ?? site.contacto.email
