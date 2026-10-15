import { enlaceConFlecha } from '../../components/estiloDeBoton'
import { designTokens } from '../../theme'
import { MARCA } from '../../theme/marca'
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
