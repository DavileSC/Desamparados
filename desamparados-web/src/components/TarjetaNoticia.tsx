import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { GOLD, GRANATE, SERIF } from '../features/home/estilos'
import type { NewsItem } from '../types'

interface NewsCardProps {
  news: NewsItem
  /** Posición en su listado: decide el tono de la placa cuando no hay foto. */
  indice?: number
  /**
   * La noticia más reciente del archivo: foto y texto lado a lado. El listado
   * le da todo el ancho; aquí solo cambia su composición interna.
   */
  destacada?: boolean
  /**
   * Consulta del listado del que sale la tarjeta (`?pagina=3&porPagina=50`).
   * Viaja en el `state` de la navegación para que el enlace «Volver a todas las
   * noticias» de la ficha devuelva a la misma página, y no a la primera. Solo
   * lo pasa el archivo de noticias: desde la portada no hay página a la que
   * volver, y entonces la ficha se queda con la ruta pelada.
   */
  volver?: string
}

// Tres letras siempre («sep», no «sept.»): la abreviatura de cada motor varía.
const fechaCorta = (iso: string) => {
  const fecha = new Date(iso)
  return `${fecha.getDate()} ${fecha.toLocaleDateString('es-ES', { month: 'long' }).slice(0, 3)} ${fecha.getFullYear()}`
}

const recorte = (lineas: number) => ({ display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) as const

// Las placas de las noticias sin foto alternan tono: tres seguidas del mismo color pesan como un solo bloque.
const TONOS_PLACA = [
  { tono: 'granate', fondo: GRANATE, letra: '#fbe9e7' },
  { tono: 'tinta', fondo: '#121012', letra: GOLD },
  { tono: 'piedra', fondo: '#3a3538', letra: '#e3d8bf' },
] as const

/**
 * Tarjeta de papel de una noticia: foto (o placa con la inicial), fecha,
 * título y extracto. La comparten la portada, Actualidad y el archivo, así que
 * una noticia se ve igual en los tres sitios.
 */
export default function TarjetaNoticia({ news, indice = 0, destacada = false, volver }: NewsCardProps) {
  const tono = TONOS_PLACA[indice % TONOS_PLACA.length]
  // Si el fichero de la foto ya no está en el servidor, la placa y no el icono
  // de imagen rota. Se guarda qué dirección falló: si la noticia cambia de foto,
  // la nueva se vuelve a intentar.
  const [fotoRota, setFotoRota] = useState<string | null>(null)
  const conFoto = Boolean(news.image) && fotoRota !== news.image
  // La destacada se abre en dos columnas desde sm; en móvil es una tarjeta más.
  const enFila = destacada ? { xs: 'flex', sm: 'grid' } : 'flex'

  return (
    <Box
      component={Link}
      to={`/actualidad/noticias/${news.slug}`}
      state={volver ? { volver } : undefined}
      data-destacada={destacada || undefined}
      sx={{
        display: enFila,
        flexDirection: 'column',
        gridTemplateColumns: destacada ? { sm: '7fr 5fr', lg: '3fr 2fr' } : undefined,
        width: '100%',
        backgroundColor: '#fbf9f6',
        color: '#1b1c1a',
        textDecoration: 'none',
        boxShadow: '0 24px 50px -30px rgba(0, 0, 0, 0.8)',
        transition: 'transform .3s ease',
        '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
        '@media (hover: hover)': {
          '&:hover': { transform: 'translateY(-3px)' },
          '&:hover .noticia-titulo': { color: GRANATE },
        },
      }}
    >
      {/* El marco fija la proporción; la foto va absoluta dentro para que, en la
          destacada, sea la columna de texto la que marque el alto y no el tamaño
          natural de la imagen. */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          aspectRatio: destacada ? { xs: '4 / 3', sm: 'auto' } : '4 / 3',
          minHeight: destacada ? { sm: 340, md: 420 } : undefined,
        }}
      >
        {conFoto ? (
          <Box
            component="img"
            src={news.image}
            onError={() => setFotoRota(news.image ?? null)}
            alt=""
            loading={destacada ? 'eager' : 'lazy'}
            decoding="async"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          // Sin foto (o con una que no carga), una placa con la inicial: la tarjeta nunca queda con un hueco.
          <Box
            data-testid="placa-noticia"
            data-tono={tono.tono}
            aria-hidden="true"
            sx={{
              position: 'absolute',
              inset: 0,
              p: destacada ? { xs: 2.5, md: 5 } : { xs: 2.5, md: 3 },
              backgroundColor: tono.fondo,
              color: tono.letra,
              fontFamily: SERIF,
              fontSize: destacada ? { xs: 120, md: 220 } : { xs: 120, md: 150 },
              lineHeight: 0.8,
            }}
          >
            {news.title.trim().charAt(0).toUpperCase()}
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: destacada ? 'center' : undefined,
          gap: destacada ? 2 : 1.5,
          flex: 1,
          p: destacada ? { xs: 2.5, sm: 4, md: 6 } : { xs: 2.5, md: 3 },
        }}
      >
        <Typography component="time" dateTime={news.date} sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: GRANATE }}>
          {fechaCorta(news.date)}
        </Typography>
        <Typography
          variant="h3"
          component="h3"
          className="noticia-titulo"
          sx={{
            fontFamily: SERIF,
            fontSize: destacada ? { xs: 22, sm: 26, md: 34 } : { xs: 20, md: 21 },
            lineHeight: destacada ? 1.2 : 1.3,
            color: '#1b1c1a',
            textWrap: 'balance',
            transition: 'color .3s ease',
          }}
        >
          {news.title}
        </Typography>
        {news.excerpt && (
          <Typography sx={{ ...recorte(destacada ? 4 : 3), fontSize: destacada ? { xs: 14, md: 16 } : 14, lineHeight: 1.6, color: '#4a454a' }}>
            {news.excerpt}
          </Typography>
        )}
        <Box
          component="span"
          sx={{ mt: destacada ? 1 : 'auto', pt: 1, display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 13, fontWeight: 600, '& svg': { fontSize: 16 } }}
        >
          Leer noticia <ArrowForwardIcon />
        </Box>
      </Box>
    </Box>
  )
}
