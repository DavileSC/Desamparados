import { lazy, Suspense } from 'react'
import { Box, Grid, Typography } from '@mui/material'
import TarjetaCristal from '../TarjetaCristal'
import { hayWebGL } from '../mapa/barrio'
import { GOLD } from '../../features/inicio/estilos'
import { anchoMaximo, valorDe } from './presentacion'
import EsqueletoDelRecorrido from './EsqueletoDelRecorrido'
import type { BloqueItinerario as Datos } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

// El mapa lleva MapLibre (unos 800 KB): se descarga aparte, solo en la página
// que lo usa, y mientras llega se ve su esqueleto, del mismo tamaño.
const RecorridoEnMapa = lazy(() => import('./RecorridoEnMapa'))

/** Lo que se lee donde iría la hora mientras no se sabe. */
const SIN_HORA = 'Por confirmar'

/** Oculto a la vista, presente para los lectores de pantalla. */
const soloLector = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/**
 * Las paradas de la procesión con su hora: en tarjetas a dos columnas (el de
 * siempre, el marcado que tenía `RecorridoPage`), en una línea vertical que
 * une las paradas como el recorrido que son, en una tabla compacta o sobre el
 * mapa del barrio, con la línea del recorrido dibujándose al bajar
 * (`RecorridoEnMapa`). Sin recorrido dibujado, o en un navegador sin WebGL,
 * «sobre el mapa» se pinta como la línea.
 *
 * El itinerario repite lugares (la procesión pasa dos veces por la misma
 * plaza): las claves necesitan el índice o React se lía al reordenar.
 */
export default function BloqueItinerario({ bloque }: { bloque: Datos }) {
  const disposicion = valorDe(bloque, 'disposicion')
  const ultima = bloque.paradas.length - 1

  const { recorrido } = bloque
  if (disposicion === 'plano' && recorrido && recorrido.linea.length >= 2 && hayWebGL()) {
    return (
      <Suspense fallback={<EsqueletoDelRecorrido bloque={bloque} />}>
        <RecorridoEnMapa bloque={{ ...bloque, recorrido }} />
      </Suspense>
    )
  }

  if (disposicion === 'linea' || disposicion === 'plano') {
    return (
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, maxWidth: anchoMaximo(bloque, '720px'), mx: 'auto' }}>
        {bloque.paradas.map((parada, i) => (
          <Box component="li" key={`${parada.hora}-${parada.lugar}-${i}`}
            sx={{ display: 'grid', gridTemplateColumns: '72px 24px minmax(0, 1fr)', alignItems: 'start', columnGap: 2 }}>
            <Typography sx={{ color: parada.hora ? 'secondary.main' : 'text.secondary', fontWeight: parada.hora ? 700 : 400, fontSize: parada.hora ? undefined : 12, fontVariantNumeric: 'tabular-nums', textAlign: 'right', pt: '2px' }}>
              {parada.hora || SIN_HORA}
            </Typography>
            <Box aria-hidden sx={{ position: 'relative', alignSelf: 'stretch', display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ position: 'absolute', top: i === 0 ? 12 : 0, bottom: i === ultima ? 'calc(100% - 12px)' : 0, width: '2px', backgroundColor: alfa(MARCA.acento, 0.35) }} />
              <Box sx={{ position: 'relative', mt: '6px', width: 12, height: 12, borderRadius: '50%', border: `2px solid ${GOLD}`, backgroundColor: 'background.default' }} />
            </Box>
            <Typography sx={{ color: 'text.primary', pb: 3 }}>{parada.lugar}</Typography>
          </Box>
        ))}
      </Box>
    )
  }

  if (disposicion === 'indice') {
    // Como el índice de un devocionario: la calle, una línea de puntos y la
    // hora. En el ordenador, a dos columnas que se leen de arriba abajo (la
    // primera mitad del camino a la izquierda); en el móvil, en una.
    const filas = Math.ceil(bloque.paradas.length / 2)
    return (
      <Box component="ol" sx={{
        listStyle: 'none', m: 0, p: 0, maxWidth: anchoMaximo(bloque, '900px'), mx: 'auto',
        display: 'grid', columnGap: 7,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
        gridTemplateRows: { md: `repeat(${filas}, auto)` },
        gridAutoFlow: { xs: 'row', md: 'column' },
      }}>
        {bloque.paradas.map((parada, i) => (
          <Box component="li" key={`${parada.hora}-${parada.lugar}-${i}`}
            sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, py: 0.875 }}>
            <Typography component="span" sx={{ color: 'text.primary', fontWeight: i === 0 || i === ultima ? 600 : 400 }}>
              {parada.lugar}
            </Typography>
            <Box component="span" aria-hidden
              sx={{ flex: '1 1 24px', minWidth: 24, borderBottom: `1px dotted ${alfa(MARCA.acento, 0.4)}`, transform: 'translateY(-4px)' }} />
            <Typography component="span" sx={{
              flexShrink: 0, fontVariantNumeric: 'tabular-nums',
              color: parada.hora ? 'secondary.main' : 'text.secondary',
              fontWeight: parada.hora ? 600 : 400, fontSize: parada.hora ? undefined : 12,
            }}>
              {parada.hora || SIN_HORA}
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }
  if (disposicion === 'tabla') {
    return (
      <Box component="table" sx={{ width: '100%', maxWidth: anchoMaximo(bloque, '720px'), mx: 'auto', borderCollapse: 'collapse' }}>
        <Box component="thead" sx={soloLector}>
          <tr><th scope="col">Hora</th><th scope="col">Lugar</th></tr>
        </Box>
        <tbody>
          {bloque.paradas.map((parada, i) => (
            <Box component="tr" key={`${parada.hora}-${parada.lugar}-${i}`} sx={{ borderTop: i === 0 ? 0 : '1px solid', borderColor: 'divider' }}>
              <Box component="td" sx={{ py: 1.25, pr: 3, width: 80, color: 'secondary.main', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{parada.hora || '—'}</Box>
              <Box component="td" sx={{ py: 1.25, color: 'text.primary' }}>{parada.lugar}</Box>
            </Box>
          ))}
        </tbody>
      </Box>
    )
  }

  return (
    <Grid container spacing={2} sx={{ maxWidth: anchoMaximo(bloque, 'none'), mx: 'auto' }}>
      {bloque.paradas.map((parada, i) => (
        <Grid key={`${parada.hora}-${parada.lugar}-${i}`} size={{ xs: 12, md: 6 }}>
          <TarjetaCristal sx={{ display: 'flex', alignItems: 'center', gap: 3, p: 3 }}>
            <Box
              sx={{
                minWidth: '80px', textAlign: 'center', px: 1.5, py: 1, borderRadius: '8px',
                backgroundColor: alfa(MARCA.principal, 0.25), color: 'secondary.main', fontWeight: 600,
              }}
            >
              {parada.hora || SIN_HORA}
            </Box>
            <Typography variant="body1" sx={{ color: 'text.primary' }}>{parada.lugar}</Typography>
          </TarjetaCristal>
        </Grid>
      ))}
    </Grid>
  )
}
