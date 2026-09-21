import type { ImagenPortada } from '../../lib/api/portada'

/**
 * Ajustes de la rotación de fotos de la cabecera. Viven fuera de Hero.tsx
 * porque un fichero que exporta un componente y además constantes rompe el
 * fast refresh de Vite.
 */

/** Sin fotos en el CMS (o sin API) la portada enseña la de siempre. */
export const IMAGENES_POR_DEFECTO: ImagenPortada[] = [
  { url: '/images/hero-1920.webp', descripcion: 'Nuestra Señora de los Desamparados en su trono procesional' },
]
/** Lo que se queda cada foto antes de fundirse con la siguiente. */
export const INTERVALO_ROTACION_MS = 7000
/** Duración del fundido, en segundos. */
export const FUNDIDO_S = 1.6
/** Las fotos van al 95 %: el degradado de encima no tiene que oscurecer tanto. */
export const OPACIDAD_FOTO = 0.95
