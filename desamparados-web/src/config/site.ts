/**
 * Quién es la corporación: el nombre, la clase, la advocación, el dominio y
 * los datos legales. Lo que no cambia de un mes a otro, para los títulos, el
 * aviso legal, la privacidad, las cookies y el pie.
 *
 * Cómo se la contacta (Secretaría, la sede, las redes, el correo de los
 * derechos) no está aquí: vive en la base, se cambia en el CMS y se lee con
 * `useContacto()` (hooks/useContacto.ts).
 *
 * Los datos que la corporación todavía no ha confirmado valen `null`: las
 * páginas legales detectan ese `null` y muestran el aviso de «pendiente de
 * confirmar» en su lugar, de modo que al rellenarlos el aviso desaparece solo
 * y no queda ningún dato inventado publicado. Obligatorios antes de publicar
 * (art. 10 LSSI-CE y art. 13 RGPD): `denominacion`, `domicilio` y un canal de
 * contacto del responsable.
 *
 * El NIF no está aquí a propósito: el Grupo Parroquial no quiere publicarlo
 * (28-09-2026), y todo lo de este fichero acaba en el código de la web.
 */
import ENTIDAD from '@instalacion/datos-entidad.json'

/**
 * Vive en `instalacion/datos-entidad.json`, que lee también la API (correos,
 * PDF). Montar la web para otra corporación empieza por ese fichero, no por el
 * código.
 */
const { identidad } = ENTIDAD

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
