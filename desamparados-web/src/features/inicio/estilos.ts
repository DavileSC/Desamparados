import { enlaceConFlecha } from '../../components/estiloDeBoton'
import { designTokens } from '../../theme'
import { MARCA } from '../../theme/marca'
import { ALTO_BARRA_ESCRITORIO, desktopMq } from '../../components/barra/estilos'
/**
 * Colores y estilos compartidos por los bloques de la portada: el ritmo es
 * hero → oscuro → foto a sangre → oscuro → foto a sangre → oscuro, con fotos
 * que nunca se tocan y bordes rectos entre bloques.
 */
export const GOLD = MARCA.acento
/** Fuente de los títulos de la web pública. Sale del tema: ver designTokens.fonts. */
export const SERIF = designTokens.fonts.heading
export const TINTA = '#0c0b0d'
export const PAPEL = '#f7f3ec'
export const GRANATE = MARCA.principal

/**
 * Pantallas de escritorio según su ALTO, no solo su ancho. Un portátil de
 * 1280 × 720 y un monitor de 1920 × 1080 son los dos «escritorio», pero en el
 * primero una tarjeta de 460 px no se ve entera y en el segundo una de 360 se
 * queda corta. Por debajo de estas alturas, las piezas de la portada se
 * compactan para caber; por encima, recuperan su aire.
 */
export const CONSULTA_ALTA = '(min-width: 900px) and (min-height: 820px)'
export const CONSULTA_MUY_ALTA = '(min-width: 900px) and (min-height: 1000px)'
export const PANTALLA_ALTA = `@media ${CONSULTA_ALTA}`

/**
 * Con el dedo, los botones pequeños (los días del calendario, sus flechas)
 * crecen hasta los 44 px. Con ratón se quedan como están: en el portátil la
 * tarjeta de la agenda tiene que caber entera.
 */
export const TACTIL = '@media (pointer: coarse)'

/**
 * Cada sección de la portada mide una pantalla: el alto que queda bajo la
 * barra fija, con su contenido centrado. Así, al bajar, cada una se ve entera y
 * cuadrada, en cualquier pantalla. El relleno de arriba y abajo va por el alto:
 * con los 88 a 104 px de antes, en un portátil bajo el contenido se salía por
 * abajo. La barra mide 56 en el móvil, 64 en la tableta (la del móvil, con el
 * Toolbar de MUI desde sm) y ALTO_BARRA_ESCRITORIO desde 1024.
 */
const RELLENO_MOVIL = 'clamp(12px, 2.5svh, 40px)'
const RELLENO = 'clamp(16px, 4.5svh, 72px)'
const PANTALLAS = {
  xs: { barra: 56, relleno: RELLENO_MOVIL },
  sm: { barra: 64, relleno: RELLENO_MOVIL },
  md: { barra: 64, relleno: RELLENO },
  escritorio: { barra: ALTO_BARRA_ESCRITORIO, relleno: RELLENO },
} as const
const util = ({ barra, relleno }: { barra: number; relleno: string }) => `(100svh - ${barra}px - 2 * ${relleno})`

export const aPantalla = {
  minHeight: { xs: `calc(100svh - ${PANTALLAS.xs.barra}px)`, sm: `calc(100svh - ${PANTALLAS.sm.barra}px)` },
  [desktopMq]: { minHeight: `calc(100svh - ${ALTO_BARRA_ESCRITORIO}px)` },
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  py: { xs: RELLENO_MOVIL, md: RELLENO },
} as const

/**
 * Una medida por el hueco útil de una sección a pantalla (su alto menos el
 * relleno), en cada tipo de pantalla: `porElHueco('height', u => `min(520px, calc${u})`)`.
 * Lo de dentro que se mide por el alto (el bloque de noticias, el libro de las
 * publicaciones) se cuenta contra esto, no contra la pantalla entera.
 */
/** El hueco útil de cada tipo de pantalla, entre paréntesis para usarlo en un `calc`. */
export const HUECO = {
  xs: util(PANTALLAS.xs),
  sm: util(PANTALLAS.sm),
  md: util(PANTALLAS.md),
  escritorio: util(PANTALLAS.escritorio),
} as const

export function porElHueco(propiedad: string, medida: (hueco: string) => string) {
  return {
    [propiedad]: { xs: medida(util(PANTALLAS.xs)), sm: medida(util(PANTALLAS.sm)), md: medida(util(PANTALLAS.md)) },
    [desktopMq]: { [propiedad]: medida(util(PANTALLAS.escritorio)) },
  }
}

/** Antetítulo en versalitas espaciadas, sobre fondo oscuro o foto. */
export const ceja = {
  display: 'block',
  mb: 1.75,
  fontSize: 11,
  // Espaciado justo para leerse en versalitas: con 0,24 em era la etiqueta de plantilla.
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#e3d8bf',
} as const

/**
 * Enlace de bloque: el enlace con flecha (components/estiloDeBoton.ts), en minúsculas
 * y con la flecha dorada. Antes iba en mayúsculas espaciadas con subrayado
 * dorado, que se parecía demasiado al de otra cofradía.
 */
export const enlaceBloque = enlaceConFlecha
