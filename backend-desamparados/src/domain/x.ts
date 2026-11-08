/**
 * Las reglas de X para publicar una noticia, sin red ni base de datos.
 *
 * El texto vive en shared/: la web lleva la cuenta mientras se escribe.
 */
export { LARGO_MAXIMO_X, LARGO_DE_UN_ENLACE, largoEnX, problemaDelTextoX, textoParaX } from '../../../shared/x.mjs';

/**
 * El lado largo de la foto que se manda. X la guarda a 4096 como mucho, pero
 * en el móvil y en el ordenador se ve a menos de 2048; más es gastar subida.
 * A 2048 y en JPEG al 88 % ninguna foto se acerca a los 5 MB que admite.
 */
export const LADO_FOTO_X = 2048;

/** El enlace al post: X no lo da al publicar, pero tiene siempre esta forma. */
export const enlaceDelPost = (usuario: string, id: string) => `https://x.com/${usuario}/status/${id}`;
