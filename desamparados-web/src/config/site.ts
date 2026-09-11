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
 * `denominacion`, `nif`, `domicilio` y un canal de contacto del responsable.
 */
export type DatoPendiente = null

export const site = {
  /** Nombre comercial con el que se identifica la web. */
  nombre: 'Grupo Parroquial de Nuestra Señora de los Desamparados',

  entidad: {
    /** Denominación jurídica exacta inscrita. PENDIENTE de confirmar. */
    denominacion: null as string | DatoPendiente,
    /** NIF/CIF de la entidad. PENDIENTE de confirmar. */
    nif: null as string | DatoPendiente,
    /** Domicilio social completo (vía, número, CP y municipio). PENDIENTE de confirmar. */
    domicilio: null as string | DatoPendiente,
    /** Localidad conocida, usable mientras no haya domicilio completo. */
    localidad: 'Málaga',
  },

  contacto: {
    email: 'info@desamparadosmalaga.com',
    /** Teléfono oficial. PENDIENTE de confirmar (no publicar uno ficticio). */
    telefono: null as string | DatoPendiente,
    horario: 'Lunes a viernes: 18:00h - 21:00h',
  },

  /** Canal para ejercer los derechos RGPD. Cae al email general si no hay uno propio. */
  privacidad: {
    emailDerechos: null as string | DatoPendiente,
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

  /** Documentos públicos enlazados desde los correos automáticos. */
  documentos: {
    normativa: null as string | DatoPendiente,
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
  site.entidad.nif === null ||
  site.entidad.domicilio === null

/** Canal de contacto para ejercer derechos RGPD. */
export const emailDerechos = site.privacidad.emailDerechos ?? site.contacto.email
