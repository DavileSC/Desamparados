import { keyframes } from '@mui/material/styles'
import type { ModoCms } from './cms'

/**
 * El fondo de las tarjetas del Inicio: el color de la tarjeta con dos focos
 * de luz difuminados que se mecen muy despacio, como el reflejo de un cirio.
 * Cada tarjeta elige su tono por lo que cuenta (dinero que entra, azul; el
 * censo y la casa, burdeos; la procesión, oro) y así se distinguen sin
 * etiquetas de colores.
 *
 * El mismo efecto en claro y en oscuro; en claro, con la luz algo más suave
 * para que sobre blanco se lea como color y no como mancha.
 */
export type TonoResplandor = 'burdeos' | 'azul' | 'oro' | 'rosa' | 'neutro'

const FOCOS: Record<TonoResplandor, { oscuro: [string, string]; claro: [string, string] }> = {
  burdeos: { oscuro: ['rgba(160, 61, 68, 0.36)', 'rgba(110, 24, 34, 0.24)'], claro: ['rgba(160, 61, 68, 0.2)', 'rgba(110, 24, 34, 0.12)'] },
  rosa: { oscuro: ['rgba(240, 138, 147, 0.24)', 'rgba(160, 61, 68, 0.2)'], claro: ['rgba(240, 138, 147, 0.26)', 'rgba(160, 61, 68, 0.1)'] },
  azul: { oscuro: ['rgba(57, 135, 229, 0.28)', 'rgba(160, 61, 68, 0.14)'], claro: ['rgba(42, 120, 214, 0.16)', 'rgba(160, 61, 68, 0.09)'] },
  oro: { oscuro: ['rgba(222, 199, 43, 0.2)', 'rgba(160, 61, 68, 0.18)'], claro: ['rgba(222, 199, 43, 0.24)', 'rgba(160, 61, 68, 0.09)'] },
  neutro: { oscuro: ['rgba(255, 255, 255, 0.08)', 'rgba(160, 61, 68, 0.12)'], claro: ['rgba(160, 61, 68, 0.08)', 'rgba(27, 28, 26, 0.05)'] },
}

/** Los dos focos viajan en sentidos opuestos por la tarjeta, y vuelven. */
const mecer = keyframes`
  from { background-position: 100% 0%, 0% 100% }
  to { background-position: 70% 30%, 30% 70% }
`

/** La animación del vaivén, para encadenarla con otra (la entrada de la tarjeta). */
export const MECER = `${mecer} 16s ease-in-out infinite alternate`

/** Estilos (sx) de una tarjeta con resplandor. `base` es el color de tarjeta del tema. */
export function fondoResplandor(modo: ModoCms, tono: TonoResplandor, base: string) {
  const [principal, secundario] = FOCOS[tono][modo]
  return {
    backgroundColor: base,
    backgroundImage: [
      `radial-gradient(closest-side, ${principal}, transparent)`,
      `radial-gradient(closest-side, ${secundario}, transparent)`,
    ].join(', '),
    backgroundRepeat: 'no-repeat',
    // Cada foco es más grande que la tarjeta: así su borde nunca se ve.
    backgroundSize: '150% 170%, 130% 150%',
    backgroundPosition: '100% 0%, 0% 100%',
    animation: MECER,
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
    // Un filo de luz arriba, como el canto de una pieza pulida.
    boxShadow: modo === 'oscuro'
      ? 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 1px 2px rgba(0, 0, 0, 0.3)'
      : 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 3px rgba(110, 24, 34, 0.08)',
    border: '1px solid',
    borderColor: modo === 'oscuro' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(110, 24, 34, 0.1)',
  }
}
