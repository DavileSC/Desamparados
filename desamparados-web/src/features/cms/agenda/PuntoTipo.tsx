import { Box } from '@mui/material'
import type { ApiEvent } from '../../../lib/api/agenda'
import { TIPOS } from '../../inicio/agenda'
import { segunModo } from '../../../theme/cms'

/**
 * El tipo con su color de la agenda, en un punto. En modo oscuro va la
 * variante clara del mismo color: la de papel se perdía sobre el fondo negro.
 * La elige el navegador (`segunModo`), sin volver a pintar al cambiar de modo.
 */
export default function PuntoTipo({ tipo }: { tipo: ApiEvent['type'] }) {
  const { nombre, color, oscuro } = TIPOS[tipo]
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13.5, whiteSpace: 'nowrap' }}>
      <Box component="span" aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, backgroundColor: segunModo(color, oscuro) }} />
      {nombre}
    </Box>
  )
}
