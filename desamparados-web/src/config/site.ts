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
import { instalacion } from './instalacion'

/**
 * Vive en `instalacion/datos-entidad.json`, que lee también la API (correos,
 * PDF), y llega a la web al cargar la página (`config/instalacion.ts`). Montar
 * la web para otra corporación empieza por ese fichero, no por el código.
 */
const { identidad } = instalacion

export const site = {
  /** Nombre comercial con el que se identifica la web. */
  nombre: identidad.nombre,
  /** El de las pestañas del navegador y el rótulo de la barra. */
  nombreCorto: identidad.nombreCorto,
  /** La clase de corporación suelta, para un rótulo o una versalita («Grupo Parroquial», «Hermandad»). Con artículo, domain/articulos.ts. */
  tipo: identidad.tipo,
  /** La misma clase, corta y sin el segundo sustantivo, para un rótulo ya situado («Datos del Grupo»). */
  tipoCorto: identidad.tipoCorto,
  /** La advocación o, con varios titulares, todos unidos con «y»: membretes y frases que los nombran a todos. */
  titular: identidad.titular,
  /** Uno o varios, en orden. */
  titulares: identidad.titulares,
  /** El primero: lo que es de una sola imagen (su foto en el trono, su texto alternativo). */
  titularPrincipal: identidad.titulares[0] ?? identidad.titular,
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

  /** Las normas o estatutos por los que se rige, que enlaza el aviso legal ({ titulo, url }), o null. */
  normas: identidad.normas,

  /**
   * Las imágenes de la marca, como las sirve /marca/ (con `?v=`, que cambia con
   * el fichero) y ya con su respaldo: `escudo`, el de sobre oscuro;
   * `escudoDestacado`, el de la papeleta (o el de sobre oscuro); `compartir`,
   * la de compartir (o el icono grande). Las de la instalación, o las de
   * partida (un escudo genérico) si faltan.
   */
  imagenes: instalacion.marca.imagenes,
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
