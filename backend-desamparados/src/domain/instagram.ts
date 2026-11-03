/**
 * Las reglas de Instagram para publicar una noticia, sin red ni base de datos.
 *
 * Instagram rechaza lo que no cumple y no lo arregla: una foto más alargada de
 * 4:5 o más apaisada de 1,91:1 vuelve con un error, y un pie de más de 2200
 * caracteres o con más de 30 etiquetas, también. Mejor ajustarlo aquí y que
 * el CMS lo enseñe antes de mandar.
 */

import { PROPORCION_MAXIMA, PROPORCION_MINIMA } from '../../../shared/instagram.mjs';

// El pie y las proporciones viven en shared/: la web los usa al escribirlo.
export {
  LARGO_MAXIMO_PIE, ETIQUETAS_MAXIMAS, MENCIONES_MAXIMAS, PROPORCION_MINIMA, PROPORCION_MAXIMA, pieDeInstagram, problemaDelPie,
} from '../../../shared/instagram.mjs';

/** Lo que Instagram guarda de ancho; más es mandar bytes que tira. */
export const ANCHO_INSTAGRAM = 1440;

const UN_DIA = 24 * 60 * 60 * 1000;
/**
 * Cada cuánto se renueva el token. Dura 60 días desde la última renovación,
 * así que con renovarlo cada semana le sobran siete semanas de margen para que
 * un fallo (Instagram caído, el servidor apagado unos días) no lo deje morir.
 */
export const RENOVAR_CADA = 7 * UN_DIA;
/** Lo que dura un token de larga duración de Instagram. */
export const DURACION_TOKEN = 60 * UN_DIA;

export interface Recorte { left: number; top: number; width: number; height: number }

/**
 * El trozo centrado de la foto que cabe en lo que admite Instagram. Una foto
 * que ya cabe se deja entera. Recortar y no rellenar con un color: con bandas
 * se ve como una captura mal hecha, y las fotos de las noticias son casi
 * siempre apaisadas normales (3:2, 4:3, 16:9), que caben sin tocar.
 */
export function recorteParaInstagram(ancho: number, alto: number): Recorte {
  const proporcion = ancho / alto;
  if (proporcion < PROPORCION_MINIMA) {
    const nuevoAlto = Math.floor(ancho / PROPORCION_MINIMA);
    return { left: 0, top: Math.floor((alto - nuevoAlto) / 2), width: ancho, height: nuevoAlto };
  }
  if (proporcion > PROPORCION_MAXIMA) {
    const nuevoAncho = Math.floor(alto * PROPORCION_MAXIMA);
    return { left: Math.floor((ancho - nuevoAncho) / 2), top: 0, width: nuevoAncho, height: alto };
  }
  return { left: 0, top: 0, width: ancho, height: alto };
}

/** Si toca renovar el token: hace una semana o más de la última vez. */
export function tocaRenovar(renovadoEl: Date, ahora: Date = new Date()): boolean {
  return ahora.getTime() - renovadoEl.getTime() >= RENOVAR_CADA;
}
