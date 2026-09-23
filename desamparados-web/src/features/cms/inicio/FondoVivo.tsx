import { Box } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { segunModo } from '../../../theme/cms'

/**
 * El fondo del Inicio: luz de cera en la penumbra. Tres focos burdeos, muy
 * difuminados, siempre en movimiento detrás de las tarjetas, que respiran
 * como la llama de un cirio. Igual en claro que en oscuro; en claro, con la
 * luz algo más contenida para que sobre el lienzo se lea como color.
 *
 * Va fijo, detrás de todo y sin recibir el ratón. Con «reducir movimiento»
 * los focos se quedan quietos.
 */
const deriva = keyframes`
  0% { transform: translate3d(0, 0, 0) scale(1) }
  25% { transform: translate3d(14vw, -10vh, 0) scale(1.15) }
  50% { transform: translate3d(4vw, 12vh, 0) scale(.9) }
  75% { transform: translate3d(-12vw, 4vh, 0) scale(1.1) }
  100% { transform: translate3d(0, 0, 0) scale(1) }
`
const respira = keyframes`
  0%, 100% { opacity: .6 }
  18% { opacity: .95 }
  26% { opacity: .72 }
  55% { opacity: 1 }
  70% { opacity: .78 }
`

const FOCOS = [
  { arriba: '-12%', izquierda: '55%', tam: '62vmax', color: '160, 61, 68', deriva: 19, respira: 5, retraso: 0 },
  { arriba: '45%', izquierda: '-18%', tam: '52vmax', color: '110, 24, 34', deriva: 24, respira: 6.5, retraso: -8 },
  { arriba: '70%', izquierda: '60%', tam: '44vmax', color: '240, 138, 147', deriva: 21, respira: 5.5, retraso: -15 },
]

export default function FondoVivo() {
  // Intensidad de cada foco en cada modo: la elige el navegador, sin volver a pintar.
  const fuerza = { claro: [0.2, 0.14, 0.22], oscuro: [0.34, 0.5, 0.14] }

  return (
    <Box aria-hidden="true" sx={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
      {FOCOS.map((f, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute', top: f.arriba, left: f.izquierda, width: f.tam, height: f.tam, borderRadius: '50%',
            background: `radial-gradient(circle at center, ${segunModo(`rgba(${f.color}, ${fuerza.claro[i]})`, `rgba(${f.color}, ${fuerza.oscuro[i]})`)} 0%, rgba(${f.color}, 0) 68%)`,
            filter: 'blur(20px)',
            willChange: 'transform, opacity',
            animation: `${deriva} ${f.deriva}s ease-in-out ${f.retraso}s infinite, ${respira} ${f.respira}s ease-in-out ${f.retraso}s infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        />
      ))}
    </Box>
  )
}
