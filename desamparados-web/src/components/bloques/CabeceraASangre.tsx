import { Box, Typography } from '@mui/material'
import ContenedorDePagina from '../ContenedorDePagina'
import { Revela } from '../SeccionAnimada'
import { GOLD, SERIF, ceja as estiloCeja } from '../../features/inicio/estilos'
import { useModoEdicion } from './modoEdicion'
import { ENCUADRE_POR_DEFECTO, srcSetDeCabecera } from './cabecera'
import Hueso, { Lineas } from '../esqueleto/Hueso'
import { caerALaOriginal, srcsetDeSubida } from '../../lib/fotoSubida'
import { MARCA } from '../../theme/marca'

/** Fondo de la página: la foto se funde a él por abajo. */
const FONDO = '#121113'
/** En escritorio la barra es fija, de 72 px, y va encima de la foto. */
const ESCRITORIO = '@media (min-width:1024px)'

/**
 * La banda: alto mínimo y no fijo, el texto abajo. La comparten la cabecera y
 * su esqueleto, para que al llegar el contenido no se mueva nada.
 */
const bandaSx = {
  position: 'relative',
  overflow: 'hidden',
  isolation: 'isolate',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  minHeight: { xs: 440, sm: 500 },
  [ESCRITORIO]: { minHeight: 'clamp(540px, 74svh, 720px)' },
} as const
const textoSx = { width: '100%', pt: 12, pb: { xs: 4, md: 6 }, [ESCRITORIO]: { pt: 'calc(72px + 72px)', pb: 7 } } as const
const cejaSx = { ...estiloCeja, color: GOLD, m: 0, mb: { xs: 1.5, md: 2 }, fontSize: { xs: 11, md: 12 }, fontWeight: 600, textShadow: '0 1px 10px rgba(0,0,0,0.9)' } as const
const TITULO = 'clamp(38px, 10.5vw, 60px)'
const TITULO_ESCRITORIO = 'clamp(64px, 7.2vw, 112px)'

interface Props {
  titulo: string
  subtitulo: string
  foto: string
  fotoAlt: string
  /** Punto de la foto, en % de su alto, que se queda a la vista al recortarla. */
  encuadre?: number
  /** Dónde está la página en el menú: la línea pequeña de encima del título. */
  ceja: string[]
}

/**
 * La cabecera de las páginas de información: la foto a todo el ancho y, sobre
 * su borde de abajo, la ceja, el título grande y el subtítulo.
 *
 * Nada se corta ni se sale, sea cual sea la pantalla:
 * - La banda tiene alto mínimo, no alto fijo: si el título ocupa tres líneas o
 *   el subtítulo es largo, crece y la foto con ella. El texto va abajo con
 *   hueco arriba para la barra.
 * - El título escala con el ancho de la ventana y, si una palabra no cabe
 *   (pantallas de 320 px), parte por sílabas en vez de desbordar.
 * - La foto se recorta con `object-fit: cover`; el encuadre dice qué altura
 *   de la foto se queda a la vista, porque la banda es apaisada en escritorio
 *   y vertical en el móvil.
 *
 * Al bajar, la foto se queda un poco atrás (paralaje) y el texto la tapa. La
 * mueve el propio navegador con una animación ligada al desplazamiento
 * (una `view-timeline` de la banda), en el mismo fotograma que la página: movida
 * desde JavaScript iba un fotograma tarde y, al subir deprisa, la foto se
 * quedaba abajo, asomaba el fondo por arriba y daba tirones. Donde el
 * navegador no sabe hacerlo, con prefers-reduced-motion y en la vista en vivo
 * del constructor, se queda quieta.
 */
export default function CabeceraASangre({ titulo, subtitulo, foto, fotoAlt, encuadre, ceja }: Props) {
  const quieta = useModoEdicion() !== null
  const encuadreY = `${Math.min(100, Math.max(0, encuadre ?? ENCUADRE_POR_DEFECTO))}%`
  const conFoto = foto !== ''

  return (
    <Box
      component="header"
      sx={{
        ...bandaSx,
        // La línea de tiempo de la paralaje: cuánto ha salido la banda por
        // arriba. Se declara aquí y no con view() en la foto porque, con el
        // overflow hidden, la banda sería el desplazador de la foto y view()
        // no avanzaría nunca.
        viewTimelineName: '--cabecera',
        // Sin foto (mientras carga o si se quita), granate casi negro: nunca un hueco gris.
        backgroundColor: MARCA.principalNoche,
      }}
    >
      {conFoto && (
        <Box
          aria-hidden={fotoAlt.trim() === '' ? true : undefined}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: -2,
            // La foto baja un 30 % de su alto mientras la banda sale por arriba
            // (del borde de arriba de la banda en lo alto de la ventana a su
            // borde de abajo): un tercio de lo que sube, así que se queda
            // atrás. Solo baja, y por abajo la recorta la banda.
            ...(quieta
              ? {}
              : {
                  '@supports (view-timeline-name: --cabecera)': {
                    '@media (prefers-reduced-motion: no-preference)': {
                      '@keyframes quedarseAtras': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(30%)' } },
                      animation: 'quedarseAtras linear both',
                      animationTimeline: '--cabecera',
                      animationRange: 'exit 0% exit 100%',
                    },
                  },
                }),
          }}
        >
          <Box
            component="img"
            src={foto}
            srcSet={srcSetDeCabecera(foto) ?? srcsetDeSubida(foto)}
            onError={(e) => { caerALaOriginal(e.currentTarget) }}
            sizes="100vw"
            alt={fotoAlt}
            decoding="async"
            fetchPriority="high"
            sx={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `50% ${encuadreY}`,
              // Se asienta al entrar: de un poco cerca a su sitio, despacio.
              '@keyframes asentarse': { from: { transform: 'scale(1.06)' }, to: { transform: 'scale(1)' } },
              ...(quieta
                ? {}
                : { '@media (prefers-reduced-motion: no-preference)': { animation: 'asentarse 1.8s cubic-bezier(.2,.7,.1,1) both' } }),
            }}
          />
        </Box>
      )}

      {/* Velo: oscuro arriba para la barra, limpio en medio y fundido al fondo
          abajo, donde va el texto. En escritorio, además, una sombra desde la
          izquierda: un título de dos líneas sube hasta media foto, y ahí la
          plata o el cielo claro se comerían la ceja. No depende de que la
          foto sea oscura. */}
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background: `linear-gradient(180deg, rgba(18,17,19,0.55) 0%, rgba(18,17,19,0) 22%, rgba(18,17,19,0.2) 40%, rgba(18,17,19,0.85) 72%, ${FONDO} 100%)`,
          [ESCRITORIO]: {
            background: [
              `linear-gradient(180deg, rgba(18,17,19,0.55) 0%, rgba(18,17,19,0) 22%, rgba(18,17,19,0.1) 40%, rgba(18,17,19,0.8) 76%, ${FONDO} 100%)`,
              'linear-gradient(90deg, rgba(18,17,19,0.72) 0%, rgba(18,17,19,0.45) 38%, rgba(18,17,19,0) 66%)',
            ].join(', '),
          },
        }}
      />

      <ContenedorDePagina sx={textoSx}>
        {ceja.length > 0 && (
          <Revela alMontar>
            <Typography component="p" sx={cejaSx}>
              {ceja.join(' · ')}
            </Typography>
          </Revela>
        )}
        <Revela alMontar efecto="cortina" orden={1}>
          <Typography
            component="h1"
            lang="es"
            sx={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: TITULO,
              [ESCRITORIO]: { fontSize: TITULO_ESCRITORIO },
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              overflowWrap: 'break-word',
              hyphens: 'auto',
              maxWidth: '16ch',
              textShadow: '0 2px 28px rgba(0,0,0,0.45)',
            }}
          >
            {titulo}
          </Typography>
        </Revela>
        {subtitulo && (
          <Revela alMontar orden={2}>
            <Typography
              sx={{
                mt: { xs: 2, md: 2.5 },
                fontSize: { xs: 17, md: 20 },
                lineHeight: 1.5,
                color: '#e4dfe1',
                maxWidth: '46ch',
                overflowWrap: 'break-word',
                textShadow: '0 1px 16px rgba(0,0,0,0.6)',
              }}
            >
              {subtitulo}
            </Typography>
          </Revela>
        )}
      </ContenedorDePagina>
    </Box>
  )
}

/**
 * La cabecera mientras llega la página: la banda con su alto de siempre y el
 * brillo de lado a lado donde irá la foto; la ceja, que sale del menú y no del
 * servidor, ya escrita, y el título y el subtítulo en huesos.
 */
export function CabeceraASangreEsqueleto({ ceja }: { ceja: string[] }) {
  return (
    <Box component="header" sx={{ ...bandaSx, backgroundColor: '#161416' }}>
      <Hueso sx={{ position: 'absolute', inset: 0, zIndex: -1, borderRadius: 0 }} />
      <ContenedorDePagina sx={textoSx}>
        {ceja.length > 0 && <Typography component="p" sx={cejaSx}>{ceja.join(' · ')}</Typography>}
        <Box sx={{ height: `calc(${TITULO} * 1.02)`, [ESCRITORIO]: { height: `calc(${TITULO_ESCRITORIO} * 1.02)` }, display: 'flex', alignItems: 'center' }}>
          <Hueso sx={{ width: 'min(64%, 560px)', height: '64%' }} />
        </Box>
        <Box sx={{ mt: { xs: 2, md: 2.5 } }}>
          <Lineas anchos={['min(92%, 470px)', 'min(52%, 270px)']} linea={{ xs: 25.5, md: 30 }} grosor={{ xs: 10, md: 12 }} />
        </Box>
      </ContenedorDePagina>
    </Box>
  )
}
