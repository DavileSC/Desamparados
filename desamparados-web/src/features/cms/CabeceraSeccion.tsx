import type { ReactNode } from 'react'
import { Stack, Typography } from '@mui/material'

/** Título de una sección del CMS con sus botones de alta a la derecha. */
export default function CabeceraSeccion({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 4, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
    >
      <Typography variant="h2" component="h1">{titulo}</Typography>
      {children && <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>{children}</Stack>}
    </Stack>
  )
}
