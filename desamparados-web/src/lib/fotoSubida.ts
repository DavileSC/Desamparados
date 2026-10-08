import type { SyntheticEvent } from 'react'

/**
 * Las fotos subidas desde el CMS llevan dos copias reducidas al lado
 * (`<hex>-640.webp` y `<hex>-1280.webp`), y existen siempre, aunque la foto
 * sea más estrecha: es el contrato de `domain/variantes-de-foto.ts` del
 * backend. Por eso basta la URL para ofrecerlas en `srcset`, sin preguntar
 * nada a la API. Las demás direcciones (las de `/images/`, las de
 * `storage/public/portada/`, los jpg y png de antes) no tienen copias y se
 * quedan como están.
 */
const SUBIDA = /^((?:https?:\/\/[^/?#]+)?\/storage\/public\/)([a-f0-9]{32})\.webp$/i

/** El ancho de la foto original como mucho: el backend la recorta a 1920 px de lado. */
const ANCHO_ORIGINAL = 1920

/** El `srcset` de una foto subida, o undefined si la URL no es de una subida con copias. */
export function srcsetDeSubida(url: string | null | undefined): string | undefined {
  const partes = url ? SUBIDA.exec(url) : null
  if (!partes) return undefined
  const [, carpeta, hex] = partes
  return `${carpeta}${hex}-640.webp 640w, ${carpeta}${hex}-1280.webp 1280w, ${url} ${ANCHO_ORIGINAL}w`
}

/**
 * Si la imagen falla y aún pedía una copia, la deja con la original y devuelve
 * true. Hace falta porque las copias de las fotos antiguas solo existen cuando
 * en el servidor se ha pasado `npm run imagenes:variantes`: hasta entonces la
 * foto tiene que verse igual. Quitar el atributo hace que el navegador vuelva a
 * elegir, y React no lo repone mientras la prop no cambie.
 */
export function caerALaOriginal(img: HTMLImageElement): boolean {
  if (!img.hasAttribute('srcset')) return false
  img.removeAttribute('srcset')
  img.removeAttribute('sizes')
  return true
}

/**
 * Las props de un `<img>` que pinta una foto que puede ser subida: `src`, y si
 * hay copias, `srcSet`, `sizes` y la vuelta a la original si fallan.
 * `alFallar` solo se llama cuando falla la original (la foto está rota de
 * verdad), no cuando faltaba una copia.
 */
export function propsDeFoto(
  url: string,
  sizes: string,
  alFallar?: (e: SyntheticEvent<HTMLImageElement>) => void,
) {
  const srcSet = srcsetDeSubida(url)
  return {
    src: url,
    ...(srcSet ? { srcSet, sizes } : {}),
    onError: (e: SyntheticEvent<HTMLImageElement>) => {
      if (!caerALaOriginal(e.currentTarget)) alFallar?.(e)
    },
  }
}
