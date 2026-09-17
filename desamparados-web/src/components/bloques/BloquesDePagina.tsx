import { Box, Stack } from '@mui/material'
import SectionTitle from '../SectionTitle'
import { componenteDeBloque } from './registro'
import type { Bloque } from '../../lib/api/contenido'

/**
 * Pinta los bloques de una página en su orden.
 *
 * Un tipo que no esté en el registro se salta en vez de tirar la página entera:
 * el servidor ya lo rechaza al guardar, pero un documento guardado antes de
 * retirar un tipo del catálogo seguiría en la base.
 */
export default function BloquesDePagina({ bloques }: { bloques: Bloque[] }) {
  if (bloques.length === 0) return null

  return (
    <Stack spacing={{ xs: 5, md: 8 }}>
      {bloques.map((bloque, indice) => {
        const Componente = componenteDeBloque(bloque)
        if (!Componente) return null
        return (
          <Box key={`${bloque.tipo}-${indice}`}>
            {bloque.titulo && <SectionTitle title={bloque.titulo} centered />}
            <Componente bloque={bloque as never} />
          </Box>
        )
      })}
    </Stack>
  )
}
