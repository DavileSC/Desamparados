import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { GOLD, GRANATE, PANTALLA_ALTA, SERIF } from '../features/inicio/estilos'
import type { Noticia } from '../types'

interface TarjetaNoticiaProps {
  noticia: Noticia
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
// Tonos velados, no planos: una placa de color liso parecía un hueco por rellenar.
const TONOS_PLACA = [
  { tono: 'granate', fondo: `radial-gradient(120% 90% at 30% 20%, #5a1620, ${GRANATE} 40%, #2a0a0f)` },
  { tono: 'tinta', fondo: 'radial-gradient(120% 90% at 30% 20%, #2a2620, #0d0c0e 60%)' },
  { tono: 'piedra', fondo: 'radial-gradient(120% 90% at 30% 20%, #3a353a, #1c1a1e 65%)' },
] as const

/**
 * Tarjeta de una noticia sobre fondo oscuro (la paleta Noche): foto, o una
 * placa con el escudo velado si no la hay; fecha, título y extracto. La
 * comparten la portada, Actualidad y el archivo, así que una noticia se ve
 * igual en los tres sitios.
 *
 * Antes era de papel claro: sobre la web oscura, tres tarjetas blancas
 * pesaban más que todo lo demás de la portada.
 */
export default function TarjetaNoticia({ noticia, indice = 0, destacada = false, volver }: TarjetaNoticiaProps) {
  const tono = TONOS_PLACA[indice % TONOS_PLACA.length]
  // Si el fichero de la foto ya no está en el servidor, la placa y no el icono
  // de imagen rota. Se guarda qué dirección falló: si la noticia cambia de foto,
  // la nueva se vuelve a intentar.
  const [fotoRota, setFotoRota] = useState<string | null>(null)
  const conFoto = Boolean(noticia.imagen) && fotoRota !== noticia.imagen
  // La destacada se abre en dos columnas desde sm; en móvil es una tarjeta más.
  const enFila = destacada ? { xs: 'flex', sm: 'grid' } : 'flex'

  return (
    <Box
      component={Link}
      to={`/noticias/${noticia.slug}`}
      state={volver ? { volver } : undefined}
      data-destacada={destacada || undefined}
      sx={{
        display: enFila,
        flexDirection: 'column',
        gridTemplateColumns: destacada ? { sm: '7fr 5fr', lg: '3fr 2fr' } : undefined,
        width: '100%',
        backgroundColor: '#18161a',
        color: '#e4e2df',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        textDecoration: 'none',
        transition: 'transform .3s ease, border-color .3s ease',
        '& .noticia-foto': { transition: 'transform .6s ease' },
        '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
        '@media (hover: hover)': {
          '&:hover': { transform: 'translateY(-3px)', borderColor: 'rgba(222, 199, 43, 0.35)' },
          '&:hover .noticia-titulo': { color: '#fff' },
          '&:hover .noticia-foto': { transform: 'scale(1.04)' },
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
          // En el móvil, por su ancho. En escritorio, por el ALTO de la pantalla:
          // en un portátil bajo la foto se encoge para que la tarjeta quepa
          // entera, y en un monitor grande crece hasta 320 px.
          aspectRatio: destacada ? { xs: '3 / 2', sm: 'auto' } : { xs: '16 / 9', md: 'auto' },
          height: destacada ? undefined : { md: 'clamp(170px, 30vh, 320px)' },
          minHeight: destacada ? { sm: 340, md: 420 } : undefined,
        }}
      >
        {conFoto ? (
          <Box
            component="img"
            src={noticia.imagen}
            onError={() => setFotoRota(noticia.imagen ?? null)}
            alt=""
            loading={destacada ? 'eager' : 'lazy'}
            decoding="async"
            className="noticia-foto"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          // Sin foto (o con una que no carga), una placa velada con el escudo: la
          // tarjeta nunca queda con un hueco, y no parece que falte algo.
          <Box
            data-testid="placa-noticia"
            data-tono={tono.tono}
            aria-hidden="true"
            sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: tono.fondo }}
          >
            <Box
              component="img"
              src="/images/escudo-grupo.png"
              alt=""
              className="noticia-foto"
              sx={{ width: destacada ? '26%' : '34%', maxWidth: 220, opacity: 0.16, filter: 'grayscale(1) brightness(1.6)' }}
            />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: destacada ? 'center' : undefined,
          gap: destacada ? 2 : 1.25,
          flex: 1,
          p: destacada ? { xs: 2.5, sm: 4, md: 6 } : { xs: 2.25, md: 2.5 },
          ...(destacada ? {} : { [PANTALLA_ALTA]: { p: 3, gap: 1.5 } }),
        }}
      >
        <Typography component="time" dateTime={noticia.fecha} sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD }}>
          {fechaCorta(noticia.fecha)}
        </Typography>
        <Typography
          variant="h3"
          component="h3"
          className="noticia-titulo"
          sx={{
            fontFamily: SERIF,
            fontSize: destacada ? { xs: 22, sm: 26, md: 34 } : { xs: 19, md: 20 },
            lineHeight: destacada ? 1.2 : 1.3,
            ...(destacada ? {} : recorte(3)),
            color: '#f2efe9',
            textWrap: 'balance',
            transition: 'color .3s ease',
          }}
        >
          {noticia.titulo}
        </Typography>
        {noticia.extracto && (
          <Typography sx={{ ...recorte(destacada ? 4 : 2), ...(destacada ? {} : { [PANTALLA_ALTA]: { WebkitLineClamp: 3 } }), fontSize: destacada ? { xs: 14, md: 16 } : 14, lineHeight: 1.6, color: '#b8b2ad' }}>
            {noticia.extracto}
          </Typography>
        )}
        <Box
          component="span"
          sx={{ mt: destacada ? 1 : 'auto', pt: destacada ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 13, fontWeight: 600, color: '#fff', '& svg': { fontSize: 16, color: GOLD } }}
        >
          Leer noticia <ArrowForwardIcon />
        </Box>
      </Box>
    </Box>
  )
}
