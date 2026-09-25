import { Box } from '@mui/material'
import { siDe, valorDe } from './presentacion'
import type { BloqueEspacio as Datos } from '../../lib/api/contenido'

const ALTOS = { pequeno: { xs: 2, md: 3 }, mediano: { xs: 4, md: 6 }, grande: { xs: 8, md: 12 } } as const

/**
 * Aire entre dos bloques, con una línea fina en medio si se quiere. No dice
 * nada: para un lector de pantalla no existe.
 */
export default function BloqueEspacio({ bloque }: { bloque: Datos }) {
  const alto = ALTOS[valorDe(bloque, 'alto') as keyof typeof ALTOS] ?? ALTOS.mediano
  return (
    <Box aria-hidden sx={{ py: alto, display: 'flex', alignItems: 'center' }}>
      {siDe(bloque, 'linea') && <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />}
    </Box>
  )
}
