/**
 * Los botones y enlaces de la web (26-09-2026, estilo «Crema» del catálogo de
 * botones, en los colores del Grupo): planos, de esquinas rectas y sin brillos.
 * En reposo, granate o con un velo crema; al pasar el ratón, pasan a blanco.
 * Ninguno lleva fondo blanco hasta que se pasa por encima.
 *
 * Sustituyen a los de esmalte (con volumen), que a su vez sustituyeron a las
 * mayúsculas espaciadas con subrayado dorado, demasiado parecidas a las de otra
 * cofradía. Todo botón y enlace de la web pública y del área de hermanos sale
 * de aquí; el CMS tiene los suyos.
 *
 * Tres estilos:
 * - `principal`: granate macizo, la acción que importa.
 * - `claro`: velo crema, sin borde, la segunda acción de una sección.
 * - `oscuro`: filete apenas visible, para las acciones secundarias de los
 *   formularios («Cancelar», «Añadir»), que no deben quitarle protagonismo al principal.
 */

const GRANATE = '#6e1822'
const TINTA = '#1b1c1a'
const ORO = '#dec72b'

/** Al pasar el ratón: fondo blanco. El color de la letra lo pone cada estilo. */
const aBlanco = (letra: string) => ({
  backgroundColor: '#ffffff',
  color: letra,
  boxShadow: 'inset 0 0 0 1px #ffffff',
})

/** Lo que comparten los tres: forma, letra, la flecha que avanza y el foco visible. */
const base = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1.25,
  minHeight: 48,
  px: 3.5,
  borderRadius: 0,
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '0.01em',
  textTransform: 'none',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  transition: 'background-color .3s ease, color .3s ease, box-shadow .3s ease',
  '& svg': { transition: 'transform .25s ease' },
  '&:hover svg': { transform: 'translateX(3px)' },
  '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: '3px' },
  // Un botón desactivado no cambia al pasar el ratón.
  '&.Mui-disabled, &[aria-disabled="true"]': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)', color: 'rgba(255, 255, 255, 0.4)', boxShadow: 'none',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover svg': { transform: 'none' },
  },
} as const

export const BOTON = {
  principal: {
    ...base,
    color: '#ffffff',
    backgroundColor: GRANATE,
    boxShadow: `inset 0 0 0 1px ${GRANATE}`,
    '&:hover': aBlanco(GRANATE),
  },
  claro: {
    ...base,
    // Un velo del color de la letra, sin borde: crema sobre oscuro y tinta sobre
    // una franja de papel, que la letra y el velo salen del tema.
    color: 'text.primary',
    backgroundColor: (t: { palette: { mode: string } }) => (t.palette.mode === 'light' ? 'rgba(27, 28, 26, 0.08)' : 'rgba(243, 239, 230, 0.1)'),
    boxShadow: 'none',
    '&:hover': aBlanco(TINTA),
  },
  oscuro: {
    ...base,
    color: 'text.primary',
    backgroundColor: 'transparent',
    boxShadow: 'inset 0 0 0 1px rgba(243, 239, 230, 0.28)',
    '&:hover': aBlanco(TINTA),
  },
} as const

export type EstiloDeBoton = keyof typeof BOTON

/**
 * Enlace de sección («Calendario completo», «Ver todas»): en minúsculas, sin
 * subrayado, con la flecha en el color de acento —oro sobre oscuro, granate
 * sobre papel— que avanza al pasar el ratón. La flecha es el `svg` de dentro.
 */
export const enlaceConFlecha = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1.25,
  minHeight: 44,
  color: 'text.primary',
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '0.01em',
  textTransform: 'none',
  textDecoration: 'none',
  transition: 'color .25s ease',
  '& svg': { fontSize: 18, color: 'secondary.main', transition: 'transform .25s ease' },
  '&:hover': { color: 'secondary.main' },
  '&:hover svg': { transform: 'translateX(4px)' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: '3px', borderRadius: '2px' },
  '@media (prefers-reduced-motion: reduce)': { '&:hover svg': { transform: 'none' } },
} as const
