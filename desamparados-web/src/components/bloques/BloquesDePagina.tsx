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
        // La clave es posicional porque `Bloque` no tiene identificador propio: el
        // prefijo del tipo evita que React reutilice el nodo de un bloque de un
        // tipo para pintar otro distinto al cambiar el número de bloques, pero no
        // distingue dos bloques del mismo tipo entre sí. Al reordenar dos bloques
        // de texto (o dos de tarjetas), la clave no cambia —sigue siendo
        // `texto-0`/`texto-1` antes y después— y React reutiliza la instancia en
        // cada posición en vez de moverla con su contenido. Hoy es inofensivo
        // porque los tres bloques son funciones puras sin estado; en cuanto haya
        // uno con estado propio —la galería de la fase 2, con su vídeo en
        // reproducción o su foto ampliada—, ese estado se quedaría pegado a la
        // posición al reordenar en vez de viajar con el bloque. Hará falta darle
        // a cada bloque un identificador estable antes de que eso ocurra.
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
