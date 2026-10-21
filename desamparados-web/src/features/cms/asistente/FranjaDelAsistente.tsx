import { Box, Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { EstadoDelAsistente } from '../../../lib/api/corporacion'

/** Los seis pasos que guardan algo; el séptimo es «Listo». */
const PASOS = 6

/**
 * En el Inicio, mientras el asistente esté a medias (tras «Seguir más tarde»):
 * cuántos pasos quedan y un botón para seguir donde se dejó.
 */
export default function FranjaDelAsistente({ estado }: { estado: EstadoDelAsistente }) {
  const quedan = PASOS - estado.paso
  return (
    <Stack component="section" aria-label="Puesta en marcha" direction="row"
      sx={{ alignItems: 'center', gap: 2, flexWrap: 'wrap', border: 1, borderColor: 'divider', borderRadius: 2, px: 2, py: 1.25 }}>
      <Stack direction="row" spacing={0.5} aria-hidden>
        {Array.from({ length: PASOS }, (_, n) => (
          <Box key={n} sx={{ width: 18, height: 5, borderRadius: 1, bgcolor: n < estado.paso ? 'success.main' : 'divider' }} />
        ))}
      </Stack>
      <Typography sx={{ flex: 1, minWidth: 200, fontWeight: 600 }}>
        {quedan === 1 ? 'Te queda 1 paso' : `Te quedan ${quedan} pasos`} para dejar la web a vuestro nombre
      </Typography>
      <Button component={Link} to="/cms/bienvenida" variant="contained" sx={{ minHeight: 40 }}>Seguir</Button>
    </Stack>
  )
}
