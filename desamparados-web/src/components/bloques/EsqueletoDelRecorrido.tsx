import { Box } from '@mui/material'
import Hueso from '../esqueleto/Hueso'
import { anchoMaximo } from './presentacion'
import type { BloqueItinerario } from '../../lib/api/contenido'
import { ALTO_LISTA, ALTO_MAPA, ALTO_MINIMO, ALTO_MINIMO_LISTA } from './altoDelRecorrido'

/**
 * Lo que ocupa el sitio del mapa del recorrido mientras se descarga: la misma
 * caja oscura y la lista de al lado en huesos, del mismo alto. Antes se veía
 * el itinerario en línea, que es mucho más largo, y la página daba un salto
 * al llegar el mapa.
 */
export default function EsqueletoDelRecorrido({ bloque }: { bloque: BloqueItinerario }) {
  // No más filas de las que caben en la lista: sobran y no se verían.
  // Con calles, la lista son las calles; si no, las paradas.
  const filas = Math.min(bloque.recorrido?.calles?.length || bloque.paradas.length, 14)
  return (
    <Box aria-busy="true" aria-label="Cargando el mapa del recorrido" sx={{ maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto' }}>
      <Hueso sx={{ height: 20, width: { xs: '85%', md: 420 }, mb: 2.5 }} />
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.45fr) minmax(0, 1fr)' },
        columnGap: { md: 7 },
      }}>
        <Box sx={{
          height: ALTO_MAPA, minHeight: ALTO_MINIMO, mb: { xs: 2, md: 0 },
          border: '1px solid rgba(204, 196, 201, 0.14)', backgroundColor: '#0b0a0c',
        }} />
        <Box sx={{ height: ALTO_LISTA, minHeight: ALTO_MINIMO_LISTA, overflow: 'hidden' }}>
          {Array.from({ length: filas }, (_, i) => (
            <Box key={i} sx={{ py: 1.5, borderBottom: '1px solid rgba(204, 196, 201, 0.14)' }}>
              <Hueso sx={{ height: 21, width: `${55 + ((i * 17) % 35)}%` }} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
