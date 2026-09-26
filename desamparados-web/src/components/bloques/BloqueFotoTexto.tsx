import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../Boton'
import ContenedorDePagina from '../ContenedorDePagina'
import { limpiarHtml } from '../../lib/limpiarHtml'
import { esDestinoValido } from '../../lib/destinos'
import { anchoMaximo, valorDe } from './presentacion'
import { SERIF } from '../../features/inicio/estilos'
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
  if (valorDe(bloque, 'estilo') === 'fundido') return <Fundido bloque={bloque} />
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

/** El fondo con el que se funde la foto: el de las franjas oscuras. */
const NOCHE = '#0a090b'

/**
 * Foto fundida: la foto a sangre, de lado a lado de la ventana, en el lado
 * elegido y fundiéndose en negro hacia el otro, donde van el título, el texto y
 * el botón. Pensada para abrir una página seria (Cultos, con el rostro de la
 * Virgen). Pinta su propio título, dentro, en vez de encima.
 *
 * En el móvil la foto ocupa todo el fondo y se oscurece por abajo, donde va el
 * texto. El pie, si lo hay, va pequeño en la esquina de la foto.
 */
function Fundido({ bloque }: { bloque: Datos }) {
  const derecha = valorDe(bloque, 'lado') === 'derecha'
  const haciaElTexto = derecha ? '90deg' : '270deg'
  return (
    <Box sx={{
      position: 'relative', isolation: 'isolate', overflow: 'hidden', backgroundColor: NOCHE,
      mx: 'calc(50% - 50vw)', minHeight: { xs: 520, md: 560 },
      display: 'flex', alignItems: { xs: 'flex-end', md: 'center' },
    }}>
      {bloque.url !== '' && (
        <Box component="img" src={bloque.url} alt={bloque.alt} decoding="async"
          sx={{
            position: 'absolute', top: 0, bottom: 0, zIndex: -2,
            [derecha ? 'right' : 'left']: 0, width: { xs: '100%', md: '75%' }, height: '100%',
            objectFit: 'cover', objectPosition: 'center 30%',
          }} />
      )}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, zIndex: -1,
        background: {
          xs: `linear-gradient(0deg, ${NOCHE} 12%, rgba(10, 9, 11, 0.7) 45%, rgba(10, 9, 11, 0.15) 100%)`,
          md: `linear-gradient(${haciaElTexto}, ${NOCHE} 0%, ${NOCHE} 26%, rgba(10, 9, 11, 0.75) 42%, rgba(10, 9, 11, 0) 70%)`,
        },
      }} />
      {/* El mismo contenedor que la página: el texto alinea con los bloques de debajo. */}
      <ContenedorDePagina sx={{
        width: '100%', py: { xs: 5, md: 8 },
        display: 'flex', justifyContent: derecha ? 'flex-start' : 'flex-end',
      }}>
        <Box sx={{ maxWidth: 480 }}>
          {bloque.titulo && (
            <Typography component="h2" sx={{ fontFamily: SERIF, fontWeight: 300, fontSize: { xs: 38, md: 54 }, lineHeight: 1.05, color: '#fff', m: 0 }}>
              {bloque.titulo}
            </Typography>
          )}
          <Box
            sx={{
              mt: bloque.titulo ? 2.5 : 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: 16.5, lineHeight: 1.75,
              '& p': { m: 0, mb: 2 }, '& > :last-child': { mb: 0 },
            }}
            dangerouslySetInnerHTML={{ __html: limpiarHtml(bloque.html) }}
          />
          {bloque.boton && esDestinoValido(bloque.enlace) && (
            <Box sx={{ mt: 3.5 }}>
              <Boton component={Link} to={bloque.enlace}>{bloque.boton}</Boton>
            </Box>
          )}
        </Box>
      </ContenedorDePagina>
      {bloque.pie && (
        <Typography component="span" sx={{ position: 'absolute', [derecha ? 'right' : 'left']: { xs: 20, md: 32 }, top: 20, fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
          {bloque.pie}
        </Typography>
      )}
    </Box>
  )
}
