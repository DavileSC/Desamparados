/**
 * Las fotos fijas que el código nombra cuando el contenido no trae otra. Viven
 * en `instalacion/imagenes/` (fuera de git y de la imagen de Docker, como la
 * marca) y nginx y Vite las sirven en `/images/`. Son las de Desamparados: otra
 * instalación no las tiene y cada una da 404.
 *
 * Por eso están todas aquí, y es el único fichero de código que puede escribir
 * una ruta `/images/` (la guardiana: backend `test/sin-fotos-escritas.test.ts`).
 * Y por eso quien las pinte tiene que aguantar que no estén sin enseñar un icono
 * roto ni un hueco: se quita la foto y queda el fondo (`useFotoQueFalla`).
 *
 * Lo que sí tiene cada instalación son las que pone su contenido (las páginas,
 * la portada, los carteles), que puede apuntar aquí o a `/storage/public/…`.
 */

/** La Virgen en su trono: la foto del hero de siempre. */
export const FOTO_DE_SIEMPRE = '/images/hero-1920.webp'
/** La misma, a 960 px: el retablo del Inicio del CMS no necesita más. */
export const FOTO_DE_SIEMPRE_REDUCIDA = '/images/hero-960.webp'

/** El cartel de un culto sin foto propia: la Titular. */
export const FOTO_DE_CULTO = '/images/triduo.jpg'
/** El cartel de una salida sin foto propia: el trono por las calles. */
export const FOTO_DE_SALIDA = '/images/trono-comitiva.webp'

/**
 * Veladas tras las dos puertas del acceso de hermanos: la Virgen de perfil
 * detrás del formulario y los nazarenos con sus cirios detrás del alta. Van en
 * la copia de 1000 px: a un 7 % de opacidad no se distingue más.
 */
export const FOTO_DEL_ACCESO = '/images/cabeceras/virgen-de-perfil-1000.webp'
export const FOTO_DE_LA_PUERTA_DEL_ALTA = '/images/cabeceras/nazarenos-con-cirios-1000.webp'

/**
 * Las fotos fijas que tienen copias más pequeñas al lado, con su `srcset`. Solo
 * cuentan si el contenido nombra esa foto: sin ella en la instalación, nadie la
 * nombra y la tabla no pide nada.
 */
export const COPIAS_DE_FOTOS_FIJAS: Readonly<Record<string, string>> = {
  [FOTO_DE_SIEMPRE]: `${FOTO_DE_SIEMPRE_REDUCIDA} 960w, ${FOTO_DE_SIEMPRE} 1920w`,
  '/images/nazarenos-1280.webp':
    '/images/nazarenos-1200.webp 1200w, /images/nazarenos-1280.webp 1280w, /images/nazarenos-1600.webp 1600w, /images/nazarenos-1920.webp 1920w',
}

/**
 * Las fotos de cabecera de la instalación (`/images/cabeceras/<nombre>.webp`)
 * llevan una copia de 1000 px al lado, `<nombre>-1000.webp`: el móvil se baja
 * esa. Es un convenio de la carpeta, no una foto concreta; quien ponga ahí una
 * cabecera nueva tiene que dejar también su copia.
 */
export const CABECERA_CON_COPIA = /^(\/images\/cabeceras\/[\w-]+)\.webp$/
