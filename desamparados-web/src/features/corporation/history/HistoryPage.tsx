import { Helmet } from 'react-helmet-async'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PageContainer from '../../../components/PageContainer'
import { Revela } from '../../../components/AnimatedSection'
import { GOLD, GRANATE, SERIF, ceja, enlaceBloque } from '../../home/estilos'
import { CLAVE_HISTORIA, getContenido, parrafosDe, type ContenidoHistoria, type HitoHistoria } from '../../../lib/api/contenido'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

// Mismo umbral que el navbar (`DESKTOP_NAV_MIN`): desde ahí la barra es fija de
// 72 px y se pone encima de la página, así que la cabecera la deja pasar.
const ESCRITORIO = '@media (min-width:1024px)'

/** Fondo de página: la foto se funde a él por arriba y por abajo de la ventana. */
const FONDO = '#262326'
/** La foto apenas se intuye: es un velo, no una foto que competir con el texto. */
const OPACIDAD_FONDO = 0.16
/** La cronología va en tinta translúcida: sigue siendo un bloque y deja pasar el velo. */
const TINTA_VELADA = 'rgba(29, 27, 30, 0.55)'
const FILETE = 'rgba(204, 196, 201, 0.22)'
const FILETE_LEVE = 'rgba(204, 196, 201, 0.1)'
/** Rosa claro del tema (`primary.light`): el granate puro no se lee sobre tinta. */
const GRANATE_CLARO = '#fc858a'

// El srcset solo vale para la foto que viene en el repositorio, que existe en
// dos tamaños. Una foto subida desde el CMS es un solo fichero.
const FONDO_DEL_REPOSITORIO = '/images/hero-1920.webp'
const SRCSET_DEL_REPOSITORIO = '/images/hero-960.webp 960w, /images/hero-1920.webp 1920w'

/** Lo que separa un hito del siguiente; la línea del raíl lo cruza. */
const HUECO = { xs: 7, md: 11 } as const
/** Dónde está el punto del raíl respecto al alto del periodo. */
const PUNTO_TOP = { xs: 14, md: 20 } as const

/** Color del periodo y del punto de cada hito según su tono. */
const TONOS = {
  ninguno: null,
  granate: { texto: GRANATE_CLARO, punto: { backgroundColor: GRANATE, borderColor: GRANATE_CLARO } },
  oro: { texto: GOLD, punto: { backgroundColor: GOLD, borderColor: GOLD } },
} as const

const idDeHito = (indice: number) => `hito-${indice + 1}`

export default function HistoryPage() {
  const { data } = useQuery({
    queryKey: CLAVE_HISTORIA,
    queryFn: () => getContenido<ContenidoHistoria>('historia'),
    retry: false,
    staleTime: 5 * 60_000,
  })
  // Mientras carga y si falla, la historia de siempre: la página no puede
  // quedarse en blanco porque el servidor tarde o no conteste.
  const historia = data ?? (POR_DEFECTO.historia as ContenidoHistoria)

  return (
    <>
      <Helmet>
        <title>{historia.titulo} | Desamparados</title>
        <meta
          name="description"
          content="Historia del Grupo Parroquial de Nuestra Señora de los Desamparados: de la devoción en la Parroquia de los Padres Pasionistas a la salida procesional del Sábado de Pasión por Málaga."
        />
      </Helmet>

      <Box sx={{ position: 'relative', isolation: 'isolate', '& a:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 4 } }}>
        {historia.fondo.url !== '' && <FondoVelado url={historia.fondo.url} />}

        <Box component="header" sx={{ pt: { xs: 8, md: 14 }, pb: { xs: 7, md: 12 }, [ESCRITORIO]: { pt: 'calc(72px + 96px)' } }}>
          <PageContainer>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 380px' },
                columnGap: { md: 8 },
                rowGap: 5,
                alignItems: 'end',
              }}
            >
              <Box>
                <Revela><Typography component="span" sx={ceja}>{historia.ceja}</Typography></Revela>
                <Revela efecto="cortina" orden={1}>
                  <Typography
                    component="h1"
                    sx={{ fontFamily: SERIF, fontSize: 'clamp(56px, 8vw, 104px)', lineHeight: 1, letterSpacing: '-0.025em' }}
                  >
                    {historia.titulo}
                  </Typography>
                </Revela>
                <Revela orden={2}>
                  <Typography sx={{ mt: { xs: 2.5, md: 3.5 }, fontSize: { xs: 17, md: 20 }, lineHeight: 1.5, color: 'text.secondary', maxWidth: '34ch' }}>
                    {historia.subtitulo}
                  </Typography>
                </Revela>
              </Box>

              {/* Índice de los momentos: cada línea lleva a su hito. */}
              {historia.hitos.length > 0 && (
                <Revela efecto="crecer" orden={3}>
                  <Box component="nav" aria-label="Momentos de la historia" sx={{ borderTop: `1px solid ${FILETE}`, pt: 1 }}>
                    {historia.hitos.map((hito, indice) => (
                      <Box
                        key={idDeHito(indice)}
                        component="a"
                        href={`#${idDeHito(indice)}`}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 3,
                          py: 1.25,
                          borderBottom: `1px solid ${FILETE_LEVE}`,
                          fontSize: 14,
                          color: '#cbc5c8',
                          transition: 'color .25s ease',
                          '& b': { fontWeight: 600, color: '#fff' },
                          '&:hover': { color: GOLD },
                          '&:hover b': { color: GOLD },
                        }}
                      >
                        <b>{hito.periodo}</b>
                        <span>{hito.etiqueta}</span>
                      </Box>
                    ))}
                  </Box>
                </Revela>
              )}
            </Box>
          </PageContainer>
        </Box>

        {historia.hitos.length > 0 && (
          <Box component="section" aria-labelledby="cronologia-titulo" sx={{ backgroundColor: TINTA_VELADA, py: { xs: 8, md: 13 } }}>
            <Typography id="cronologia-titulo" component="h2" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
              Cronología
            </Typography>
            <PageContainer>
              <Box component="ol" aria-label="Cronología del Grupo Parroquial" sx={{ listStyle: 'none', m: 0, p: 0, maxWidth: 1072, mx: 'auto' }}>
                {historia.hitos.map((hito, indice) => (
                  <HitoDeLaLinea key={idDeHito(indice)} hito={hito} id={idDeHito(indice)} primero={indice === 0} ultimo={indice === historia.hitos.length - 1} />
                ))}
              </Box>
            </PageContainer>
          </Box>
        )}

        <Box component="section" aria-labelledby="seguir-titulo" sx={{ py: { xs: 8, md: 12 } }}>
          <PageContainer>
            <Box
              sx={{
                maxWidth: 1072,
                mx: 'auto',
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
                gap: { xs: 4, md: 6 },
                alignItems: 'end',
              }}
            >
              <Revela>
                <Typography component="span" sx={ceja}>{historia.cierre.ceja}</Typography>
                <Typography id="seguir-titulo" component="h2" sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 34 }, lineHeight: 1.2, letterSpacing: '-0.01em', maxWidth: '20ch' }}>
                  {historia.cierre.titulo}
                </Typography>
              </Revela>
              <Revela orden={1}>
                <Box component={Link} to="/corporacion/historia/organos-de-gobierno" sx={enlaceBloque}>
                  {historia.cierre.enlace} <ArrowForwardIcon />
                </Box>
              </Revela>
            </Box>
          </PageContainer>
        </Box>
      </Box>
    </>
  )
}

/**
 * La foto velada detrás de toda la página. La caja de la foto es pegajosa
 * dentro de un contenedor que abarca la página entera: se queda quieta a la
 * altura de la ventana mientras el texto pasa por encima, y se va con la
 * página al llegar al pie, sin pisarlo. El contenedor recorta con `clip` y no
 * con `hidden`: un `hidden` haría de caja de scroll y la foto dejaría de
 * pegarse a la ventana. Es decorativa: sin alt y fuera del árbol accesible.
 */
function FondoVelado({ url }: { url: string }) {
  const esLaDelRepositorio = url === FONDO_DEL_REPOSITORIO
  return (
    <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'clip', pointerEvents: 'none' }}>
      <Box sx={{ position: 'sticky', top: 0, height: '100svh' }}>
        <Box
          component="img"
          src={url}
          srcSet={esLaDelRepositorio ? SRCSET_DEL_REPOSITORIO : undefined}
          sizes={esLaDelRepositorio ? '100vw' : undefined}
          alt=""
          decoding="async"
          fetchPriority="low"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // Corona y rostro a la vista en cualquier ventana con la foto del
            // repositorio (el rostro está al 40 % de su ancho); con otra foto,
            // un encuadre alto-centrado es lo que mejor aguanta.
            objectPosition: esLaDelRepositorio ? '40% 28%' : '50% 30%',
            opacity: OPACIDAD_FONDO,
            filter: 'saturate(0.85)',
          }}
        />
        <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${FONDO} 0%, transparent 24%, transparent 72%, ${FONDO} 100%)` }} />
      </Box>
    </Box>
  )
}

interface HitoDeLaLineaProps {
  hito: HitoHistoria
  id: string
  primero: boolean
  ultimo: boolean
}

/**
 * Un hito de la cronología: el periodo, el raíl con su punto y el cuerpo. En
 * escritorio van en tres columnas; en móvil el periodo pasa encima del texto
 * y el raíl se pega al margen izquierdo.
 */
function HitoDeLaLinea({ hito, id, primero, ultimo }: HitoDeLaLineaProps) {
  const tono = TONOS[hito.tono] ?? null
  const parrafos = parrafosDe(hito.relato)

  return (
    <Revela
      as="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '24px minmax(0, 1fr)', md: '200px 40px minmax(0, 1fr)' },
        gridTemplateAreas: { xs: '"rail periodo" "rail cuerpo"', md: '"periodo rail cuerpo"' },
        columnGap: { xs: 2.5, md: 5 },
        rowGap: { xs: 2, md: 0 },
        pb: ultimo ? 0 : HUECO,
        scrollMarginTop: { xs: 80, md: 104 },
      }}
      id={id}
    >
      <Box sx={{ gridArea: 'periodo', textAlign: { md: 'right' }, pt: { md: '6px' } }}>
        <Typography
          component="span"
          sx={{ display: 'block', fontFamily: SERIF, fontSize: { xs: 40, md: 52 }, lineHeight: 1, letterSpacing: '-0.02em', color: tono?.texto ?? '#fff' }}
        >
          {hito.periodo}
        </Typography>
        <Typography component="span" sx={{ ...ceja, mb: 0, mt: { xs: 1, md: 1.75 }, letterSpacing: '0.22em' }}>
          {hito.etiqueta}
        </Typography>
      </Box>

      {/* El raíl: una línea que cruza todos los hitos y un punto por cada uno.
          La línea de cada hito llega hasta el hueco con el siguiente; la del
          primero arranca en su punto y la del último termina en el suyo. */}
      <Box
        aria-hidden="true"
        sx={{
          gridArea: 'rail',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: '50%',
            width: '1px',
            transform: 'translateX(-50%)',
            backgroundColor: FILETE,
            top: primero ? PUNTO_TOP : 0,
            bottom: ultimo ? 'auto' : { xs: -56, md: -88 },
            height: ultimo ? PUNTO_TOP : 'auto',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: PUNTO_TOP,
            width: 13,
            height: 13,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            boxSizing: 'border-box',
            border: '2px solid #cbc5c8',
            backgroundColor: FONDO,
            ...tono?.punto,
          }}
        />
      </Box>

      <Box sx={{ gridArea: 'cuerpo' }}>
        <Typography component="h2" sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 30 }, lineHeight: 1.2, letterSpacing: '-0.01em', mb: 2 }}>
          {hito.titulo}
        </Typography>
        {parrafos.map((parrafo, indice) => (
          <Typography key={indice} sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 17 }, lineHeight: 1.75, maxWidth: '56ch', mb: 2.75, '&:last-of-type': { mb: 0 } }}>
            {parrafo}
          </Typography>
        ))}
        {hito.foto.url !== '' && (
          <Revela efecto="desvelar" retraso={0.2} sx={{ mt: 4 }}>
            <Box
              component="img"
              src={hito.foto.url}
              alt={hito.foto.alt}
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', maxWidth: 560, aspectRatio: '560 / 340', objectFit: 'cover' }}
            />
            {hito.foto.pie !== '' && (
              <Typography component="span" sx={{ ...ceja, mb: 0, mt: 1.75, fontSize: 12, letterSpacing: '0.12em' }}>
                {hito.foto.pie}
              </Typography>
            )}
          </Revela>
        )}
      </Box>
    </Revela>
  )
}
