import { Box } from '@mui/material'
import type { ApiEvent } from '../../../lib/api/events'
import { TIPOS } from '../../home/agenda'

/**
 * El tipo con el color que lleva en la agenda de la portada, en un punto: el
 * color está pensado para el papel claro de la web y como fondo de una
 * etiqueta no se leería en el CMS oscuro.
 */
export default function PuntoTipo({ tipo }: { tipo: ApiEvent['type'] }) {
  const { nombre, color } = TIPOS[tipo]
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13.5, whiteSpace: 'nowrap' }}>
      <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.35)' }} />
      {nombre}
    </Box>
  )
}
