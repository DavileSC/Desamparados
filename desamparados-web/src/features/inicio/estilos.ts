import { enlaceEsmalte } from '../../components/esmalte'
import { designTokens } from '../../theme'
/**
 * Colores y estilos compartidos por los bloques de la portada: el ritmo es
 * hero → oscuro → foto a sangre → oscuro → foto a sangre → oscuro, con fotos
 * que nunca se tocan y bordes rectos entre bloques.
 */
export const GOLD = '#dec72b'
/** Fuente de los títulos de la web pública. Sale del tema: ver designTokens.fonts. */
export const SERIF = designTokens.fonts.heading
export const TINTA = '#0c0b0d'
export const PAPEL = '#f7f3ec'
export const GRANATE = '#6e1822'

/** Antetítulo en versalitas espaciadas, sobre fondo oscuro o foto. */
export const ceja = {
  display: 'block',
  mb: 1.75,
  fontSize: 11,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  color: '#e3d8bf',
} as const

/**
 * Enlace de bloque: el enlace esmalte (components/esmalte.ts), en minúsculas
 * y con la flecha dorada. Antes iba en mayúsculas espaciadas con subrayado
 * dorado, que se parecía demasiado al de otra cofradía.
 */
export const enlaceBloque = enlaceEsmalte
