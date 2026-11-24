import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { GOLD, SERIF } from '../../features/inicio/estilos'
import type { Noticia } from '../../types'
import { PlacaDeNoticia } from '../TarjetaNoticia'
import { propsDeFoto } from '../../lib/fotoSubida'
import { posicionDe } from '../../lib/encuadre'
import { filaSx, marcoCuadradoSx, principalAlto } from './archivoDeNoticiasEstilos'

/*
 * El archivo de noticias (forma 4b, elegida en maqueta el 24-11-2026): la más
 * reciente en grande, con el título sobre la foto, y el resto en dos columnas
 * con la foto cuadrada al lado. Es lo más compacto de lo que se probó: con dos
 * «Cargar más» (31 noticias) mide la tercera parte que las tarjetas a media
 * pantalla, y la principal sigue luciendo arriba.
 *
 * Los textos se cortan por líneas y no por caracteres: el título admite 191 y
 * el extracto 300, y sin tope una noticia larga tapaba la cara de la foto en la
 * principal o descuadraba su fila. Enteros se leen al abrir la noticia.
 */

/** Tres letras siempre («sep», no «sept.»), como en la tarjeta de la portada. */
const fechaCorta = (iso: string) => {
  const fecha = new Date(iso)
  return `${fecha.getDate()} ${fecha.toLocaleDateString('es-ES', { month: 'long' }).slice(0, 3)} ${fecha.getFullYear()}`
}

const recorte = (lineas: number | Record<string, number>) => ({ display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) as const

const fechaSx = { fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD } as const

const enlaceSx = {
  textDecoration: 'none', color: 'inherit',
  '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
  '& .noticia-foto': { transition: 'transform .6s ease' },
  '@media (hover: hover)': {
    '&:hover .noticia-foto': { transform: 'scale(1.04)' },
    '&:hover .noticia-titulo': { color: '#fff' },
  },
} as const

/**
 * La foto de la noticia recortada a su marco, con su encuadre; sin foto (las
 * de antes de que fuera obligatoria) o con una que ya no carga, el escudo de
 * reserva, para que ninguna deje un hueco.
 */
function FotoDeNoticia({ noticia, sizes, prioritaria = false, indice }: { noticia: Noticia; sizes: string; prioritaria?: boolean; indice: number }) {
  const [rota, setRota] = useState<string | null>(null)
  if (!noticia.imagen || rota === noticia.imagen) return <PlacaDeNoticia indice={indice} ancho={prioritaria ? '22%' : '46%'} />
  return (
    <Box
      component="img"
      {...propsDeFoto(noticia.imagen, sizes, () => setRota(noticia.imagen ?? null))}
      alt=""
      loading={prioritaria ? 'eager' : 'lazy'}
      decoding="async"
      className="noticia-foto"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: posicionDe(noticia.encuadre) }}
    />
  )
}

/**
 * La principal: la foto a todo el ancho del contenedor y el texto encima, sobre
 * un velo que oscurece de abajo arriba. Llega hasta la fecha aun con tres
 * líneas de título: con una foto clara (velas, cielo) el oro de la fecha no se
 * leía si quedaba por encima. El título va a tres líneas como mucho y
 * más pequeño si es largo: entero, con 191 caracteres, ocupaba ocho y subía por
 * encima del velo, sobre la cara de la imagen y sin contraste.
 */
export function NoticiaPrincipal({ noticia, volver }: { noticia: Noticia; volver?: string }) {
  const largo = noticia.titulo.length > 70
  return (
    <Box
      component={Link}
      to={`/noticias/${noticia.slug}`}
      state={volver ? { volver } : undefined}
      data-principal
      sx={{ ...enlaceSx, position: 'relative', display: 'grid', alignContent: 'end', overflow: 'hidden', minHeight: principalAlto, backgroundColor: '#18161a' }}
    >
      <FotoDeNoticia noticia={noticia} sizes="(min-width: 1280px) 1200px, 100vw" prioritaria indice={2} />
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7, 6, 8, 0.95) 0%, rgba(7, 6, 8, 0.78) 45%, rgba(7, 6, 8, 0.25) 75%, rgba(7, 6, 8, 0) 92%)' }} />
      <Box sx={{ position: 'relative', display: 'grid', gap: { xs: 1.5, md: 2 }, p: { xs: 2.5, sm: 4, md: 7 }, maxWidth: 860 }}>
        <Typography component="time" dateTime={noticia.fecha} sx={fechaSx}>{fechaCorta(noticia.fecha)}</Typography>
        <Typography
          variant="h3"
          component="h3"
          className="noticia-titulo"
          sx={{
            fontFamily: SERIF, fontWeight: 300, color: '#f2efe9', textWrap: 'balance', overflowWrap: 'anywhere', transition: 'color .3s ease',
            fontSize: largo ? { xs: 26, sm: 34, md: 42 } : { xs: 30, sm: 42, md: 54 },
            lineHeight: 1.08,
            ...recorte(3),
          }}
        >
          {noticia.titulo}
        </Typography>
        {noticia.extracto && (
          <Typography sx={{ fontSize: { xs: 15, md: 17 }, lineHeight: 1.6, color: '#d8d1cb', maxWidth: '58ch', ...recorte({ xs: 3, md: 3 }) }}>
            {noticia.extracto}
          </Typography>
        )}
        <Box component="span" sx={leerSx}>Leer noticia <ArrowForwardIcon /></Box>
      </Box>
    </Box>
  )
}

const leerSx = { mt: 0.5, display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 13, fontWeight: 600, color: '#fff', '& svg': { fontSize: 16, color: GOLD } } as const


/**
 * El resto de noticias. El título va a tres líneas y el extracto a tres (dos
 * en la tableta, ninguno en el móvil, donde la columna de texto es estrecha):
 * así cada fila mide más o menos lo que su foto y las dos columnas no se
 * descuadran.
 */
export function FilaDeNoticia({ noticia, indice, volver }: { noticia: Noticia; indice: number; volver?: string }) {
  return (
    <Box component={Link} to={`/noticias/${noticia.slug}`} state={volver ? { volver } : undefined} sx={{ ...enlaceSx, ...filaSx }}>
      <Box sx={marcoCuadradoSx}>
        <FotoDeNoticia noticia={noticia} sizes="(min-width: 1200px) 200px, (min-width: 600px) 160px, 104px" indice={indice} />
      </Box>
      <Box sx={{ display: 'grid', gap: 0.75, minWidth: 0 }}>
        <Typography component="time" dateTime={noticia.fecha} sx={fechaSx}>{fechaCorta(noticia.fecha)}</Typography>
        <Typography
          variant="h3"
          component="h3"
          className="noticia-titulo"
          sx={{ fontFamily: SERIF, fontSize: { xs: 17, md: 21 }, lineHeight: 1.25, color: '#f2efe9', textWrap: 'balance', overflowWrap: 'anywhere', transition: 'color .3s ease', ...recorte(3) }}
        >
          {noticia.titulo}
        </Typography>
        {noticia.extracto && (
          <Typography sx={{ display: { xs: 'none', sm: '-webkit-box' }, fontSize: 14, lineHeight: 1.55, color: '#b8b2ad', WebkitLineClamp: { sm: 2, lg: 3 }, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {noticia.extracto}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
