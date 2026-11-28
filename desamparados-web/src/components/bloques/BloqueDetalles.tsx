import { Box, Typography } from '@mui/material'
import { SERIF } from '../../features/inicio/estilos'
import { parrafosDe, type BloqueDetalles as Datos, type DetalleDeImagen } from '../../lib/api/contenido'
import { propsDeFoto } from '../../lib/fotoSubida'
import { useFotoQueFalla } from '../../hooks/useFotoQueFalla'
import { MARCA } from '../../theme/marca'

/**
 * Detalle a detalle (Sagrada titular, 27-11-2026): la página se acerca a la
 * Virgen poco a poco, el rostro, la corona, el corazón, las manos, la saya,
 * cada uno con su foto a pantalla y su texto al lado. El lado de la foto
 * cambia en cada detalle para que se lea como un recorrido y no como una
 * lista; en el móvil la foto va siempre encima.
 *
 * Sale de lado a lado de la ventana, como la foto fundida: la foto toca el
 * borde y el texto respira en el otro. La foto es cuadrada, con tope de alto,
 * para que en una pantalla grande no ocupe más que la ventana.
 */
export default function BloqueDetalles({ bloque }: { bloque: Datos }) {
  // Sin título del bloque, cada detalle es una sección de la página (h2);
  // con él, va debajo (h3).
  const nivel = bloque.titulo.trim() === '' ? 'h2' : 'h3'
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, mx: 'calc(50% - 50vw)' }}>
      {bloque.detalles.map((detalle, i) => (
        <Detalle key={i} detalle={detalle} numero={i + 1} total={bloque.detalles.length} fotoALaDerecha={i % 2 === 1} nivel={nivel} />
      ))}
    </Box>
  )
}

interface DetalleProps {
  detalle: DetalleDeImagen
  numero: number
  total: number
  fotoALaDerecha: boolean
  nivel: 'h2' | 'h3'
}

function Detalle({ detalle, numero, total, fotoALaDerecha, nivel }: DetalleProps) {
  // Una foto que no carga se quita y el texto se queda solo, a lo ancho.
  const { visible, alFallar } = useFotoQueFalla(detalle.foto.url)
  return (
    <Box component="li" sx={{
      display: 'grid', alignItems: 'center',
      gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: !visible ? 'minmax(0, 1fr)' : fotoALaDerecha ? 'minmax(0, 5fr) minmax(0, 7fr)' : 'minmax(0, 7fr) minmax(0, 5fr)' },
      gridTemplateAreas: { xs: visible ? '"foto" "texto"' : '"texto"', md: !visible ? '"texto"' : fotoALaDerecha ? '"texto foto"' : '"foto texto"' },
    }}>
      {visible && (
        <Box component="img" {...propsDeFoto(detalle.foto.url, '(min-width: 900px) 60vw, 100vw', alFallar)} alt={detalle.foto.alt} loading="lazy" decoding="async"
          sx={{ gridArea: 'foto', display: 'block', width: '100%', aspectRatio: '1 / 1', maxHeight: { md: '86vh' }, objectFit: 'cover' }} />
      )}
      <Box sx={{ gridArea: 'texto', minWidth: 0, maxWidth: 560, px: { xs: 2.5, sm: 4, md: 6, lg: 10 }, pt: { xs: 3.5, md: 6 }, pb: { xs: 6, md: 6 } }}>
        <Typography component="p" sx={{ m: 0, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'text.secondary' }}>
          <Box component="span" sx={{ color: MARCA.acento, fontWeight: 600 }}>Detalle {numero}</Box> de {total}
        </Typography>
        <Typography component={nivel} sx={{ fontFamily: SERIF, fontWeight: 600, fontSize: { xs: 30, md: 40 }, lineHeight: 1.1, mt: 1.5, mb: 1.5 }}>
          {detalle.titulo}
        </Typography>
        {parrafosDe(detalle.texto).map((parrafo, j) => (
          <Typography key={j} sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 17 }, lineHeight: 1.7, mb: 1.5, '&:last-of-type': { mb: 0 } }}>{parrafo}</Typography>
        ))}
      </Box>
    </Box>
  )
}
