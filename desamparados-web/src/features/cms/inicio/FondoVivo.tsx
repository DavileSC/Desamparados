import { Box } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { useTemaCms } from '../../../app/useTemaCms'

/**
 * El fondo del Inicio: luz de cera en la penumbra. Tres focos burdeos, muy
 * difuminados, que se desplazan despacio detrás de las tarjetas y respiran
 * como la llama de un cirio. Igual en claro que en oscuro; en claro, con la
 * luz algo más contenida para que sobre el lienzo se lea como color.
 *
 * Va fijo, detrás de todo y sin recibir el ratón. Con «reducir movimiento»
 * los focos se quedan quietos.
 */
const deriva = keyframes`
  0% { transform: translate3d(0, 0, 0) scale(1) }
  33% { transform: translate3d(6vw, -4vh, 0) scale(1.08) }
  66% { transform: translate3d(-4vw, 5vh, 0) scale(.94) }
  100% { transform: translate3d(0, 0, 0) scale(1) }
`
const respira = keyframes`
  0%, 100% { opacity: .75 }
  18% { opacity: .95 }
  26% { opacity: .82 }
  55% { opacity: 1 }
  70% { opacity: .86 }
`

const FOCOS = [
  { arriba: '-12%', izquierda: '55%', tam: '62vmax', color: '160, 61, 68', deriva: 46, respira: 7, retraso: 0 },
  { arriba: '45%', izquierda: '-18%', tam: '52vmax', color: '110, 24, 34', deriva: 58, respira: 9, retraso: -14 },
  { arriba: '70%', izquierda: '60%', tam: '44vmax', color: '240, 138, 147', deriva: 52, respira: 8, retraso: -30 },
]

export default function FondoVivo() {
  const { modo } = useTemaCms()
  const oscuro = modo === 'oscuro'
  // Intensidad de cada foco en cada modo.
  const fuerza = oscuro ? [0.34, 0.5, 0.14] : [0.2, 0.14, 0.22]

  return (
    <Box aria-hidden="true" sx={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
      {FOCOS.map((f, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute', top: f.arriba, left: f.izquierda, width: f.tam, height: f.tam, borderRadius: '50%',
            background: `radial-gradient(circle at center, rgba(${f.color}, ${fuerza[i]}) 0%, rgba(${f.color}, 0) 68%)`,
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
