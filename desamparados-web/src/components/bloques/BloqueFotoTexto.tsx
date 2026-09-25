import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../Boton'
import { limpiarHtml } from '../../lib/limpiarHtml'
import { esDestinoValido } from '../../lib/destinos'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueFotoTexto as Datos } from '../../lib/api/contenido'

/**
 * Una foto a un lado y un texto con formato al otro, con un botón opcional
 * debajo del texto. En el móvil van siempre una encima de otra, la foto
 * primero, sea cual sea el lado elegido: así nunca queda un texto estrujado
 * junto a una foto diminuta.
 *
 * El HTML llega saneado del servidor y se vuelve a sanear aquí, como el del
 * bloque de texto.
 */
export default function BloqueFotoTexto({ bloque }: { bloque: Datos }) {
  const derecha = valorDe(bloque, 'lado') === 'derecha'
  const tercio = valorDe(bloque, 'anchoFoto') === 'tercio'
  const proporcion = valorDe(bloque, 'proporcion')
  const arriba = valorDe(bloque, 'alineacionVertical') === 'arriba'
  // A la mitad, las dos columnas iguales; a un tercio, el texto ocupa el doble.
  const columnaFoto = 'minmax(0, 1fr)'
  const columnaTexto = tercio ? 'minmax(0, 2fr)' : 'minmax(0, 1fr)'

  return (
    <Box sx={{
      maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto',
      display: 'grid', gap: { xs: 3, md: 6 }, alignItems: arriba ? 'start' : 'center',
      gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: derecha ? `${columnaTexto} ${columnaFoto}` : `${columnaFoto} ${columnaTexto}` },
      gridTemplateAreas: { xs: '"foto" "texto"', md: derecha ? '"texto foto"' : '"foto texto"' },
    }}>
      <Box component="figure" sx={{ gridArea: 'foto', m: 0 }}>
        {bloque.url !== '' && (
          <Box component="img" src={bloque.url} alt={bloque.alt} loading="lazy" decoding="async"
            sx={{
              display: 'block', width: '100%', height: 'auto', borderRadius: 2,
              ...(proporcion !== 'original' && { aspectRatio: proporcion.replace(':', ' / '), objectFit: 'cover' }),
            }} />
        )}
        {bloque.pie && (
          <Typography component="figcaption" variant="body2" sx={{ color: 'text.secondary', mt: 1.25 }}>{bloque.pie}</Typography>
        )}
      </Box>
      <Box sx={{ gridArea: 'texto', minWidth: 0 }}>
        <Box
          sx={{
            color: 'text.secondary', lineHeight: 1.8,
            '& p': { mb: 2.5 }, '& h2, & h3': { color: 'text.primary', mt: 3, mb: 1.5 },
            '& > :first-child': { mt: 0 }, '& > :last-child': { mb: 0 },
          }}
          dangerouslySetInnerHTML={{ __html: limpiarHtml(bloque.html) }}
        />
        {bloque.boton && esDestinoValido(bloque.enlace) && (
          <Box sx={{ mt: 3.5 }}>
            <Boton component={Link} to={bloque.enlace}>{bloque.boton}</Boton>
          </Box>
        )}
      </Box>
    </Box>
  )
}
