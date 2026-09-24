import { Box } from '@mui/material'
import type { ApiEvent } from '../../../lib/api/agenda'
import { TIPOS } from '../../inicio/agenda'
import { colorDelTipo } from './tiposEvento'

/**
 * El tipo con su color, en un punto: el del CMS en cada modo (`colorDelTipo`),
 * que elige el navegador sin volver a pintar al cambiar de modo.
 */
export default function PuntoTipo({ tipo }: { tipo: ApiEvent['type'] }) {
  const { nombre } = TIPOS[tipo]
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13.5, whiteSpace: 'nowrap' }}>
      <Box component="span" aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, backgroundColor: colorDelTipo(tipo) }} />
      {nombre}
    </Box>
  )
}
