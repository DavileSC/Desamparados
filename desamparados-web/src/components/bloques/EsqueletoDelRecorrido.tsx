import { Box } from '@mui/material'
import Hueso from '../esqueleto/Hueso'
import { anchoMaximo } from './presentacion'
import type { BloqueItinerario } from '../../lib/api/contenido'

/**
 * El alto del mapa y, en escritorio, también el de la lista de al lado. Con la
 * frase de encima y la cabecera, el bloque entero cabe en la pantalla con
 * holgura: no hace falta dejar el scroll clavado para ver el mapa entero. En
 * el móvil, mapa y lista van uno encima del otro y también caben juntos.
 *
 * Aquí y no en `RecorridoEnMapa`: el esqueleto los necesita antes de que
 * llegue MapLibre, y traerlos de allí lo metería en la descarga principal.
 */
export const ALTO_MAPA = { xs: '40svh', md: 'min(760px, calc(100svh - 210px))' }
export const ALTO_LISTA = { xs: '28svh', md: ALTO_MAPA.md }
export const ALTO_MINIMO = { xs: 230, md: 380 }
export const ALTO_MINIMO_LISTA = { xs: 170, md: ALTO_MINIMO.md }

/**
 * Lo que ocupa el sitio del mapa del recorrido mientras se descarga: la misma
 * caja oscura y la lista de al lado en huesos, del mismo alto. Antes se veía
 * el itinerario en línea, que es mucho más largo, y la página daba un salto
 * al llegar el mapa.
 */
export default function EsqueletoDelRecorrido({ bloque }: { bloque: BloqueItinerario }) {
  // No más filas de las que caben en la lista: sobran y no se verían.
  const filas = Math.min(bloque.paradas.length, 9)
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
            <Box key={i} sx={{ py: 2.25, borderBottom: '1px solid rgba(204, 196, 201, 0.14)' }}>
              <Hueso sx={{ height: 22, width: `${55 + ((i * 17) % 35)}%` }} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
