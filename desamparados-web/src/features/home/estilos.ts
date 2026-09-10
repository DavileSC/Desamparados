/**
 * Colores y estilos compartidos por los bloques de la portada: el ritmo es
 * hero → oscuro → foto a sangre → oscuro → foto a sangre → oscuro, con fotos
 * que nunca se tocan y bordes rectos entre bloques.
 */
export const GOLD = '#dec72b'
export const SERIF = '"Libre Caslon Text", serif'
export const TINTA = '#1d1b1e'
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

/** Enlace de bloque: mayúsculas espaciadas con subrayado dorado. */
export const enlaceBloque = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1.25,
  minHeight: 44,
  pb: '6px',
  borderBottom: `2px solid ${GOLD}`,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.26em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  '& svg': { fontSize: 16, transition: 'transform .25s ease' },
  '&:hover': { color: GOLD },
  '&:hover svg': { transform: 'translateX(4px)' },
} as const
