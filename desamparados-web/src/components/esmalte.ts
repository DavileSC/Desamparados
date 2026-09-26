/**
 * Los botones y enlaces de la web, en estilo «esmalte» (26-09-2026): botones
 * con volumen, como una medalla esmaltada —un brillo arriba, sombra abajo— que
 * se levantan un poco al pasar el ratón, y enlaces en minúsculas con una flecha
 * dorada que avanza.
 *
 * Sustituyen a las mayúsculas espaciadas con subrayado dorado, que se parecían
 * demasiado a los de otra cofradía. Todo botón y enlace de la web pública y del
 * área de hermanos sale de aquí; el CMS tiene los suyos.
 *
 * Tres esmaltes:
 * - `principal`: granate, la acción que importa.
 * - `claro`: crema, la segunda acción de una sección de la web.
 * - `oscuro`: discreto, para las acciones secundarias de los formularios
 *   («Cancelar», «Añadir»), que no deben quitarle protagonismo al principal.
 */

const levantar = {
  transition: 'transform .25s ease, box-shadow .25s ease, background .25s ease, color .25s ease',
  '&:hover': { transform: 'translateY(-2px)' },
  '&:active': { transform: 'translateY(0)' },
  '& svg': { transition: 'transform .25s ease' },
  '&:hover svg': { transform: 'translateX(3px)' },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover': { transform: 'none' },
    '&:hover svg': { transform: 'none' },
  },
} as const

/** Lo que comparten los tres: forma, letra y el foco visible. */
const base = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1.25,
  minHeight: 48,
  px: 3.5,
  borderRadius: '4px',
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '0.01em',
  textTransform: 'none',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: '3px' },
  // Un botón desactivado no brilla ni se levanta.
  '&.Mui-disabled, &[aria-disabled="true"]': {
    background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.4)', boxShadow: 'none', transform: 'none',
  },
  ...levantar,
} as const

export const ESMALTE = {
  principal: {
    ...base,
    color: '#ffffff',
    background: 'linear-gradient(180deg, #8a2230 0%, #6e1822 55%, #5a131c 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255, 220, 160, 0.45), inset 0 -2px 0 rgba(0, 0, 0, 0.25), 0 6px 18px rgba(110, 24, 34, 0.35)',
    '&:hover': {
      ...levantar['&:hover'],
      color: '#ffffff',
      background: 'linear-gradient(180deg, #972638 0%, #7a1b26 55%, #5f141e 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255, 220, 160, 0.6), inset 0 -2px 0 rgba(0, 0, 0, 0.25), 0 10px 24px rgba(110, 24, 34, 0.5)',
    },
  },
  claro: {
    ...base,
    color: '#1b1c1a',
    background: 'linear-gradient(180deg, #fbf6ea 0%, #e9dfcb 100%)',
    boxShadow: 'inset 0 1px 0 #ffffff, inset 0 -2px 0 rgba(0, 0, 0, 0.12), 0 6px 18px rgba(0, 0, 0, 0.35)',
    '&:hover': {
      ...levantar['&:hover'],
      color: '#1b1c1a',
      background: 'linear-gradient(180deg, #ffffff 0%, #efe6d3 100%)',
      boxShadow: 'inset 0 1px 0 #ffffff, inset 0 -2px 0 rgba(0, 0, 0, 0.12), 0 10px 24px rgba(0, 0, 0, 0.45)',
    },
  },
  oscuro: {
    ...base,
    color: '#f3efe6',
    background: 'linear-gradient(180deg, #2a272b 0%, #1a181b 100%)',
    border: '1px solid rgba(243, 239, 230, 0.12)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -2px 0 rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.35)',
    '&:hover': {
      ...levantar['&:hover'],
      color: '#ffffff',
      background: 'linear-gradient(180deg, #332f34 0%, #1f1d20 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 -2px 0 rgba(0, 0, 0, 0.35), 0 8px 18px rgba(0, 0, 0, 0.45)',
    },
  },
} as const

export type Esmalte = keyof typeof ESMALTE

/**
 * Enlace de sección («Calendario completo», «Ver todas»): en minúsculas, sin
 * subrayado, con la flecha en el color de acento —oro sobre oscuro, granate
 * sobre papel— que avanza al pasar el ratón. La flecha es el `svg` de dentro.
 */
export const enlaceEsmalte = {
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
