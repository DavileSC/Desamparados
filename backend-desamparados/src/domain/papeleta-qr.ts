import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * El código del QR de la papeleta de sitio: lo que se lee en la puerta del
 * templo para saber que la papeleta es de verdad y de quién es.
 *
 * Es el contrato entre la papeleta (que lo imprime) y el escaneo (que lo lee):
 *
 *     DSP1.<id de la papeleta>.<firma>
 *
 * `DSP1` es la versión del formato; la firma, un HMAC-SHA256 de
 * `DSP1.<id>` recortado a 16 caracteres en base64 «de URL» (96 bits). Sin la
 * clave del servidor no se puede fabricar el código de otra papeleta, ni
 * cambiar el número de una para hacerse pasar por otra.
 *
 * El código solo dice QUÉ papeleta es: si sigue valiendo (no se anuló, es de
 * esta salida) lo decide quien lo lee mirando la base, nunca el código. Y no
 * lleva datos personales: un QR fotografiado no enseña nada.
 *
 * La clave sale de `JWT_SECRET` con su propia etiqueta, así que no hace falta
 * otra variable. Rotar `JWT_SECRET` deja sin validez los QR ya impresos: se
 * vuelven a descargar desde el área de hermanos.
 */

const VERSION = 'DSP1';
const LARGO_FIRMA = 16;

function clave(secreto = process.env.JWT_SECRET): Buffer {
  if (!secreto) throw new Error('Falta JWT_SECRET para firmar el código de la papeleta.');
  return createHmac('sha256', secreto).update('papeleta-de-sitio-qr').digest();
}

const firma = (id: number, secreto?: string) =>
  createHmac('sha256', clave(secreto)).update(`${VERSION}.${id}`).digest('base64url').slice(0, LARGO_FIRMA);

/** El texto que va en el QR de una papeleta. */
export function codigoDePapeleta(id: number, secreto?: string): string {
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Id de papeleta no válido: ${id}`);
  return `${VERSION}.${id}.${firma(id, secreto)}`;
}

/**
 * El id de la papeleta de un código leído, o null si no es un código de
 * papeleta o la firma no cuadra. Admite espacios alrededor (lo que añada el
 * lector) y nada más.
 */
export function leerCodigoDePapeleta(texto: string, secreto?: string): number | null {
  const m = /^DSP1\.([1-9]\d{0,9})\.([A-Za-z0-9_-]{16})$/.exec(texto.trim());
  if (!m) return null;
  const id = Number(m[1]);
  const esperada = Buffer.from(firma(id, secreto));
  const llegada = Buffer.from(m[2]);
  return esperada.length === llegada.length && timingSafeEqual(esperada, llegada) ? id : null;
}
