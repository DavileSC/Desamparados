import type { ReactNode } from 'react'
import { Stack, Typography } from '@mui/material'

/** Título de una sección del CMS con sus botones de alta a la derecha, y debajo del título, si lo hay, un resumen. */
export default function CabeceraSeccion({ titulo, subtitulo, children }: { titulo: string; subtitulo?: ReactNode; children?: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 4, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
    >
      <div>
        <Typography variant="h2" component="h1">{titulo}</Typography>
        {subtitulo && <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{subtitulo}</Typography>}
      </div>
      {children && <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>{children}</Stack>}
    </Stack>
  )
}
