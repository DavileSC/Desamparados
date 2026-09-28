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
export type DatoPendiente = null

export const site = {
  /** Nombre comercial con el que se identifica la web. */
  nombre: 'Grupo Parroquial de Nuestra Señora de los Desamparados',

  entidad: {
    /** Denominación jurídica exacta inscrita. */
    denominacion: 'Parroquia Santa María Goretti - Grupo Parroquial Nuestra Señora de los Desamparados' as string | DatoPendiente,
    /** Domicilio social completo (vía, número, CP y municipio). */
    domicilio: 'Calle Corregidor Paz Guzmán, 13, 29006 Málaga' as string | DatoPendiente,
    /** Localidad conocida, usable mientras no haya domicilio completo. */
    localidad: 'Málaga',
  },

  contacto: {
    email: 'goretti.desamparados@gmail.com',
    /** Teléfono oficial, el mismo que el de Secretaría. */
    telefono: '644 90 01 67' as string | DatoPendiente,
    /** El de Secretaría: los textos del alta lo citan entre paréntesis, en minúscula. */
    horario: 'Primer viernes de cada mes, de 19:30 a 21:00',
  },

  /**
   * Dónde está el Grupo Parroquial, para quien quiere ir: el pie de página. No
   * es el domicilio social de `entidad`, que es un dato legal y sigue pendiente.
   */
  sede: {
    nombre: 'Iglesia Parroquial Santa María Goretti',
    direccion: 'C. Corregidor Paz Guzmán, 13',
    localidad: 'Málaga',
    /** Abre Google Maps en otra pestaña con la parroquia buscada. */
    comoLlegar: 'https://www.google.com/maps/search/?api=1&query=Iglesia%20Parroquial%20Santa%20Mar%C3%ADa%20Goretti%2C%20M%C3%A1laga',
  },

  /** Canal para ejercer los derechos RGPD. Cae al email general si no hay uno propio. */
  privacidad: {
    emailDerechos: 'goretti.desamparados@gmail.com' as string | DatoPendiente,
  },

  /**
   * Perfiles oficiales. Un `null` significa que el Grupo Parroquial todavía no ha
   * facilitado la URL: la interfaz oculta ese enlace en vez de publicar uno
   * muerto que lleve a `#`.
   */
  redes: {
    facebook: 'https://www.facebook.com/desamparadosmalaga/' as string | DatoPendiente,
    instagram: 'https://www.instagram.com/desamparadosmalaga/' as string | DatoPendiente,
    x: 'https://x.com/GPDesamparados' as string | DatoPendiente,
    youtube: null as string | DatoPendiente,
  },

  /** Retransmisión en directo desde la sede. `null` si no hay stream publicado. */
  directo: {
    urlAlternativa: null as string | DatoPendiente,
  },

  /** Documentos públicos. */
  documentos: {
    /** Las normas diocesanas de los Grupos Parroquiales, por las que se rige: se enlazan desde el aviso legal. */
    estatutos: 'https://www.dropbox.com/scl/fi/qm6eg5f22lghfnnt9ens3/01-Grupos-Parroquiales.pdf?rlkey=o4bkqz058m9faddsyd8y59k7r&dl=0' as string | DatoPendiente,
  },
} as const

/** Texto a mostrar cuando un dato legal obligatorio aún no está confirmado. */
export const DATO_PENDIENTE = 'pendiente de confirmar'

/** Devuelve el valor si está informado, o el aviso de pendiente. */
export function legal(valor: string | DatoPendiente): string {
  return valor ?? DATO_PENDIENTE
}

/** `true` si falta algún dato identificativo exigido por la LSSI/RGPD. */
export const faltanDatosIdentificativos =
  site.entidad.denominacion === null ||
  site.entidad.domicilio === null

/** Canal de contacto para ejercer derechos RGPD. */
export const emailDerechos = site.privacidad.emailDerechos ?? site.contacto.email
