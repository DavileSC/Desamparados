import { Box } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { MARCA } from '../../theme/marca'

const rayo = keyframes`
  0% { opacity: 1; transform: translateY(12px) scaleY(1.2); }
  100% { opacity: 0; transform: translateY(-6px) scaleY(.3); }
`

const RAYOS = Array.from({ length: 8 }, (_, i) => i * 45)

/**
 * La chispa de oro que sale del «+» al añadir algo (el Click Spark de React
 * Bits): ocho rayos finos que se abren y se apagan en medio segundo. Se monta
 * de nuevo con cada pulsación (cambiando su `key`), y así vuelve a saltar.
 * Quien pide menos movimiento no la ve.
 */
export default function Chispa() {
  return (
    <Box component="span" aria-hidden sx={{
      position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none',
      '@media (prefers-reduced-motion: reduce)': { display: 'none' },
    }}>
      {RAYOS.map((grados) => (
        <Box key={grados} component="span" sx={{
          position: 'absolute', left: 0, top: 0, transform: `rotate(${grados}deg)`,
          '&::after': {
            content: '""', position: 'absolute', left: '-1px', top: '-34px', width: 2, height: 10, borderRadius: '1px',
            bgcolor: MARCA.acento, opacity: 0, animation: `${rayo} .55s ease-out both`,
          },
        }} />
      ))}
    </Box>
  )
}
