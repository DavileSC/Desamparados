import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import SeccionAnimada, { Revela } from '../../components/SeccionAnimada'
import { PlacaDeNoticia } from '../../components/TarjetaNoticia'
import Hueso from '../../components/esqueleto/Hueso'
import EnCarga from '../../components/esqueleto/EnCarga'
import { estadoDeConsulta } from '../../components/esqueleto/esperaDeCarga'
import CintaDestacada from './CintaDestacada'
import { pedirUltimasNoticias } from '../../lib/api/noticias'
import { propsDeFoto } from '../../lib/fotoSubida'
import { useDatosDePortada } from './useDatosDePortada'
import { useTextosPortada } from './useContenidoPortada'
import TextoDePortada from './TextoDePortada'
import AvisosDeInicio from './AvisosDeInicio'
import { GOLD, aPantalla, enlaceBloque, porElHueco } from './estilos'
import { CORMORANT } from '../actualidad/agenda/letraAlmanaque'
import { useModulos } from '../../hooks/useModulos'
import type { Noticia } from '../../types'

// Las que manda el servidor (NOTICIAS_EN_PORTADA): una grande y dos pequeñas.
const MAX_NOTICIAS = 3

/** Del móvil a la tableta, la grande arriba y las pequeñas en filas debajo. */
const ENFILADAS = '@media (max-width: 899.95px)'
const LADO_A_LADO = '@media (min-width: 900px)'


// Mismo hueco con esqueleto y con noticias: lo que hay debajo no salta al llegar.
// Con tope por abajo (en una pantalla tumbada de móvil no cabe nada legible)
// y por arriba (en un monitor muy alto, una foto de 900 px pesa demasiado).
const bloqueSx = {
  display: 'grid',
  gap: 2,
  // Lo que queda para las noticias: el hueco útil de la sección (la pantalla
  // bajo la barra, menos su relleno) menos la línea de «Ver todas» (8 + 44).
  ...porElHueco('height', (hueco) => `clamp(320px, calc(${hueco} - 52px), 680px)`),
  gridTemplateColumns: '1fr',
  // En el móvil la grande se queda con lo que dejan las dos filas.
  gridTemplateRows: 'minmax(0, 1fr) auto auto',
  [LADO_A_LADO]: {
    gridTemplateColumns: '7fr 5fr',
    gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
  },
} as const

// Tres letras siempre («sep», no «sept.»): la abreviatura de cada motor varía.
const fechaCorta = (iso: string) => {
  const fecha = new Date(iso)
  return `${fecha.getDate()} ${fecha.toLocaleDateString('es-ES', { month: 'long' }).slice(0, 3)} ${fecha.getFullYear()}`
}

/**
 * El velo de abajo de la foto: tinta firme hasta `firme` % del alto y, desde
 * ahí, aclarando por pasos cortos hasta desaparecer (una curva, no una
 * rampa: con dos o tres paradas se veía el escalón, como un corte en la foto).
 */
const velo = (firme: number) => {
  const pasos = [[0, 0.95], [firme, 0.9], [firme + 8, 0.78], [firme + 16, 0.6], [firme + 24, 0.4], [firme + 32, 0.22], [firme + 40, 0.09], [firme + 48, 0]]
  return `linear-gradient(0deg, ${pasos.map(([d, a]) => `rgba(12,11,13,${a}) ${Math.min(d, 100)}%`).join(', ')})`
}

const recorte = (lineas: number) => ({ display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) as const

/**
 * Actualidad: tres noticias fijas, una grande y dos pequeñas a su lado, con la
 * foto a sangre en cada una y el texto sobre su velo.
 *
 * Las manda el servidor ya ordenadas: la destacada delante, si la hay, y detrás
 * las más recientes. La primera es la grande.
 */
export default function NoticiasDestacadas() {
  const { activos, activo } = useModulos()
  // La lista llega en milisegundos y en esta instalación todo está encendido:
  // mejor un esqueleto mientras no se sabe que un hueco que luego crece.
  const apagado = activos !== null && !activo('noticias')
  const consulta = useDatosDePortada('noticias', pedirUltimasNoticias, activos !== null && activo('noticias'))
  const { data: todas = [], isPending, isError, refetch } = consulta
  const noticias = todas.slice(0, MAX_NOTICIAS)
  const textos = useTextosPortada()
  if (apagado) return null

  return (
    <SeccionAnimada cascada id="actualidad" aria-labelledby="actualidad-titulo" sx={{ ...aPantalla, backgroundColor: '#121113' }}>
      <ContenedorDePagina>
        {/* Sin título a la vista: las noticias hablan por sí solas y el alto que
            ocupaba es para ellas. Queda para el lector de pantalla, que nombra
            la sección con él (y sigue siendo editable en el CMS). */}
        <Typography id="actualidad-titulo" component="h2" className="home-visually-hidden">
          {textos.actualidad.titulo}
        </Typography>
        {isPending || isError ? (
          <EnCarga
            estado={estadoDeConsulta(consulta)}
            que="las noticias"
            alReintentar={() => { void refetch() }}
            esqueleto={(
              <Box sx={bloqueSx}>
                <Hueso sx={{ display: 'block', height: '100%', borderRadius: 0, [LADO_A_LADO]: { gridRow: 'span 2' } }} />
                <Hueso sx={{ display: 'block', height: '100%', borderRadius: 0, [ENFILADAS]: { height: 88 } }} />
                <Hueso sx={{ display: 'block', height: '100%', borderRadius: 0, [ENFILADAS]: { height: 88 } }} />
              </Box>
            )}
          />
        ) : noticias.length === 0 ? (
          <AvisosDeInicio mensaje="No hay noticias publicadas por el momento." />
        ) : (
          <Box
            component="ul"
            aria-label={textos.actualidad.titulo}
            sx={{
              ...bloqueSx,
              listStyle: 'none',
              m: 0,
              p: 0,
              // Con una sola, ocupa todo: sin una columna vacía a su lado.
              ...(noticias.length === 1 ? { [LADO_A_LADO]: { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' } } : {}),
            }}
          >
            {noticias.map((noticia, i) => (
              <Revela
                key={noticia.id}
                as="li"
                efecto="crecer"
                orden={2 + i}
                sx={{
                  position: 'relative',
                  minHeight: 0,
                  display: 'flex',
                  ...(i === 0 && noticias.length > 1 ? { [LADO_A_LADO]: { gridRow: 'span 2' } } : {}),
                }}
              >
                {noticia.fijada && <CintaDestacada />}
                <NoticiaDePortada noticia={noticia} indice={i} grande={i === 0} />
              </Revela>
            ))}
          </Box>
        )}
        {/* «Ver todas», pegado a las noticias, al pie y a la derecha. Sin entrada
            animada: la entrada lo bajaba 40 px y solo se disparaba al verse, así
            que con las noticias a pantalla justa no llegaba a aparecer. */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Box component={Link} to="/noticias" sx={enlaceBloque}>
            <TextoDePortada anchos={['5em']}>{textos.actualidad.enlace}</TextoDePortada> <span className="home-visually-hidden">las noticias</span> <ArrowForwardIcon />
          </Box>
        </Box>
      </ContenedorDePagina>
    </SeccionAnimada>
  )
}

/**
 * Una noticia de la portada: la foto entera con su velo y, encima, fecha,
 * titular y «Leer noticia»; la grande lleva además el extracto. En el móvil
 * cambian de forma: la grande pone el texto bajo la foto (en una foto baja el
 * velo se comía media imagen) y las pequeñas son filas con la miniatura.
 */
function NoticiaDePortada({ noticia, indice, grande }: { noticia: Noticia; indice: number; grande: boolean }) {
  // Si el fichero de la foto ya no está en el servidor, la placa y no el icono de imagen rota.
  const [fotoRota, setFotoRota] = useState<string | null>(null)
  const conFoto = Boolean(noticia.imagen) && fotoRota !== noticia.imagen

  return (
    <Box
      component={Link}
      to={`/noticias/${noticia.slug}`}
      data-grande={grande || undefined}
      sx={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        display: 'block',
        color: 'inherit',
        textDecoration: 'none',
        backgroundColor: '#18161a',
        '& .noticia-foto': { transition: 'transform .6s ease' },
        '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
        '@media (hover: hover)': {
          '&:hover .noticia-foto': { transform: 'scale(1.04)' },
          '&:hover .noticia-leer': { color: GOLD },
        },
        [ENFILADAS]: grande
          ? { display: 'flex', flexDirection: 'column' }
          : { display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', height: 88 },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          [ENFILADAS]: grande
            ? { position: 'relative', inset: 'auto', flex: '1 1 auto', minHeight: 120 }
            : { position: 'relative', inset: 'auto', height: 88 },
        }}
      >
        {conFoto ? (
          <Box
            component="img"
            {...propsDeFoto(noticia.imagen ?? '', grande ? '(min-width: 900px) 760px, 100vw' : '(min-width: 900px) 540px, 88px', () => setFotoRota(noticia.imagen ?? null))}
            alt=""
            loading={grande ? 'eager' : 'lazy'}
            decoding="async"
            className="noticia-foto"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          // El escudo, por encima del texto de abajo para que no lo pise.
          <PlacaDeNoticia indice={indice} ancho={grande ? 'min(30%, 24svh)' : 'min(26%, 14svh)'} sx={{ [LADO_A_LADO]: { pb: grande ? '18%' : '22%' } }} />
        )}
        {/* El velo, abajo, donde va el texto. Firme hasta donde llega la fecha
            (sobre una fachada encalada el blanco y el oro se perdían). En el
            móvil no hay texto encima: sin velo. */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            // Un píxel de más por cada lado: con anchos fraccionarios asomaba
            // un hilo claro de la foto en el borde, sin velar.
            inset: '-1px',
            background: velo(grande ? 30 : 34),
            '@media (max-height: 700px)': { background: velo(grande ? 38 : 42) },
            [ENFILADAS]: { display: 'none' },
          }}
        />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          left: grande ? 32 : 24,
          right: grande ? 32 : 24,
          bottom: grande ? 28 : 20,
          display: 'flex',
          flexDirection: 'column',
          gap: grande ? 1.25 : 0.75,
          [ENFILADAS]: {
            position: 'static',
            justifyContent: 'center',
            minWidth: 0,
            gap: grande ? 1 : 0.5,
            px: grande ? 2.5 : 2,
            py: grande ? 2 : 0,
          },
          '@media (max-width: 899.95px) and (max-height: 700px)': grande ? { py: 1.5 } : {},
        }}
      >
        <Typography component="time" dateTime={noticia.fecha} sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD }}>
          {fechaCorta(noticia.fecha)}
        </Typography>
        <Typography
          component="h3"
          sx={{
            fontFamily: CORMORANT,
            fontWeight: 500,
            m: 0,
            color: '#fff',
            textWrap: 'balance',
            ...recorte(grande ? 3 : 2),
            // Por el alto de la pantalla: en un portátil bajo, más pequeño, para que quepa.
            fontSize: grande ? 'clamp(28px, 4.6svh, 46px)' : 'clamp(20px, 2.8svh, 26px)',
            lineHeight: grande ? 1.08 : 1.12,
            [ENFILADAS]: grande ? { fontSize: 26, WebkitLineClamp: 2 } : { fontSize: 18, lineHeight: 1.15 },
          }}
        >
          {noticia.titulo}
        </Typography>
        {grande && noticia.extracto && (
          <Typography
            sx={{
              m: 0,
              fontSize: 15,
              lineHeight: 1.6,
              color: '#d5d0ca',
              maxWidth: '52ch',
              ...recorte(2),
              // En una pantalla baja, o en el móvil, fuera el extracto: el titular
              // y «Leer noticia» siempre se ven.
              '@media (max-height: 700px)': { display: 'none' },
              [ENFILADAS]: { display: 'none' },
            }}
          >
            {noticia.extracto}
          </Typography>
        )}
        <Box
          component="span"
          className="noticia-leer"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            transition: 'color .2s',
            '& svg': { fontSize: 16, color: GOLD },
            // En las filas del móvil no cabe, ni en la grande de un móvil bajo:
            // la tarjeta entera es el enlace, así que no se pierde nada.
            ...(grande
              ? { '@media (max-width: 899.95px) and (max-height: 700px)': { display: 'none' } }
              : { [ENFILADAS]: { display: 'none' } }),
          }}
        >
          Leer noticia <ArrowForwardIcon />
        </Box>
      </Box>
    </Box>
  )
}
