import { useContext, useEffect, useRef, useState, type MouseEvent } from 'react'
import CuentaAtrasDeSalida from './CuentaAtrasDeSalida'
import { Box, IconButton, Typography } from '@mui/material'
import { m, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { ahorraDatos } from '../../lib/videoPropio'
import { enlaceConFlecha } from '../../components/estiloDeBoton'
import Boton from '../../components/Boton'
import { Revela } from '../../components/SeccionAnimada'
import { CURVA_ENTRADA } from '../../components/entrada'
import { FUNDIDO_S, IMAGENES_POR_DEFECTO, INTERVALO_ROTACION_MS, OPACIDAD_FOTO } from './heroImagenes'
import { BorradorPortadaContext, usePortada, useTextosPortada } from './useContenidoPortada'
import TextoDePortada from './TextoDePortada'
import { useModulos } from '../../hooks/useModulos'
import { ENCUADRE_MOVIL_POR_DEFECTO } from '../../lib/api/portada'
import { propsDeFoto } from '../../lib/fotoSubida'

// Desplazamiento máximo de la imagen (px) cuando el cursor está en el borde del hero
const PARALLAX_X = 14
const PARALLAX_Y = 9
// La primera foto entra posándose desde este zoom, y tarda esto en quedarse quieta.
const ZOOM_DE_ENTRADA = 1.08
const POSADO_S = 2.8
// Los textos empiezan a entrar cuando la página ya se ha fundido (TransicionDePagina, 0,35 s).
const RETRASO_TEXTOS_S = 0.25

export default function Hero() {
  const reduceMotion = useReducedMotion()

  // Los textos, por el hook que comparten los otros cinco bloques y no por una
  // copia de su expresión: el único test de «la API falla y salen los textos de
  // siempre» corre sobre el hook, y con la copia aquí este bloque —el que más
  // se ve— se quedaba justo fuera de esa red.
  const textos = useTextosPortada()
  const { activos, activo } = useModulos()
  // El enlace puede pintarse mientras no se sabe (la lista llega en milisegundos):
  // retirarlo después sería peor que dejarlo un instante de más.
  const conAgenda = activos === null || activo('agenda')
  // En la vista previa del CMS el título no es el de la pantalla: la pantalla
  // ya tiene el suyo, «Portada», y dos títulos principales confunden al lector.
  const enVistaPrevia = useContext(BorradorPortadaContext) !== null

  // Las fotos las decide el CMS, y para ellas hace falta el `status` de la
  // consulta: hasta que llega la lista no se pinta ninguna, porque si se
  // pintara la de siempre mientras tanto cada visita empezaría con un fundido
  // de la foto vieja a la nueva. Llamar a las dos no cuesta otra petición:
  // react-query deduplica por la clave, que es la misma.
  const { data, status } = usePortada()
  // Las que no cargan (borradas, o de /images/ y que faltan en la instalación)
  // salen de la rotación: el fondo, no el icono roto.
  const [rotas, setRotas] = useState<ReadonlySet<string>>(() => new Set())
  const imagenes = (status === 'pending' ? null : data && data.imagenes.length > 0 ? data.imagenes : IMAGENES_POR_DEFECTO)
    ?.filter((imagen) => !rotas.has(imagen.url)) ?? null
  const total = imagenes?.length ?? 0

  // El vídeo de fondo, si el CMS ha puesto uno. Lo ve solo quien no ha pedido
  // menos movimiento ni ahorrar datos: los demás se quedan con las fotos, que
  // no cuestan nada más. La primera foto es además su `poster`, lo que se ve
  // mientras llega. Si el vídeo falla (borrado, red caída), vuelven las fotos.
  const [ahorro] = useState(ahorraDatos)
  const [videoFallido, setVideoFallido] = useState(false)
  const conVideo = Boolean(textos.hero.video) && imagenes !== null && !reduceMotion && !ahorro && !videoFallido
  const video = useRef<HTMLVideoElement>(null)
  // Todo lo que se mueve solo más de cinco segundos tiene que poder pararse
  // (WCAG 2.2.2): por eso el botón de pausa.
  // Lo mismo con las fotos que rotan solas: el botón también para el pase.
  const [pausado, setPausado] = useState(false)
  const rotan = total >= 2 && !reduceMotion && !conVideo
  const alternarPausa = () => {
    if (!conVideo) { setPausado((p) => !p); return }
    const el = video.current
    if (!el) return
    if (el.paused) { void el.play(); setPausado(false) } else { el.pause(); setPausado(true) }
  }

  // Fundidos hechos: la foto visible es `tick % total`. Con una sola foto no
  // hay nada que rotar, y con prefers-reduced-motion tampoco se rota (home.css
  // anula además las transiciones y la rotación quedaría en cortes secos).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!rotan || pausado) return
    const id = window.setInterval(() => {
      // En una pestaña en segundo plano no se avanza: al volver no hay salto.
      if (document.hidden) return
      setTick((t) => t + 1)
    }, INTERVALO_ROTACION_MS)
    return () => window.clearInterval(id)
  }, [rotan, pausado])
  const actual = total > 0 ? tick % total : 0

  // Parallax que sigue levemente al ratón: la imagen se mueve en sentido contrario al
  // cursor (sensación de profundidad) con un muelle suave. Sin efecto en táctil
  // (no hay mousemove) ni con prefers-reduced-motion.
  const targetX = useMotionValue(0)
  const targetY = useMotionValue(0)
  const x = useSpring(targetX, { stiffness: 50, damping: 18, mass: 0.8 })
  const y = useSpring(targetY, { stiffness: 50, damping: 18, mass: 0.8 })

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (reduceMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5 // -0.5 … 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    targetX.set(-nx * 2 * PARALLAX_X)
    targetY.set(-ny * 2 * PARALLAX_Y)
  }

  const handleMouseLeave = () => {
    targetX.set(0)
    targetY.set(0)
  }

  return (
    <Box
      component="section"
      aria-labelledby="hero-title"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      sx={{
        position: 'relative',
        width: '100%',
        // Hero a pantalla completa: la siguiente sección queda por debajo del pliegue.
        // 100dvh en móvil tiene en cuenta la barra del navegador; 100vh es el fallback.
        height: { xs: 'calc(100svh - 64px)', md: '100svh' },
        minHeight: 560,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        overflow: 'hidden',
        // Lo que se ve antes de que llegue la primera foto.
        backgroundColor: '#0c0b0d',
      }}
    >
      {/* Capa de imagen ligeramente mayor que el hero para que al moverse no asome el fondo.
          Las fotos van apiladas: la visible encima, y la que viene se monta debajo con
          antelación para que ya esté cargada cuando le toque fundirse. */}
      <Box
        component={m.div}
        style={{ x, y }}
        sx={{
          position: 'absolute',
          top: `-${PARALLAX_Y}px`,
          bottom: `-${PARALLAX_Y}px`,
          left: `-${PARALLAX_X}px`,
          right: `-${PARALLAX_X}px`,
          zIndex: 0,
          willChange: 'transform',
        }}
      >
        {conVideo && imagenes && (
          <Box
            component={m.video}
            ref={video}
            src={textos.hero.video}
            poster={imagenes[0]?.url}
            // Decorativo: lo que dice la cabecera está en sus textos.
            aria-hidden="true"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onError={() => setVideoFallido(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: OPACIDAD_FOTO }}
            transition={{ duration: FUNDIDO_S, ease: 'easeInOut' }}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: { xs: `${ENCUADRE_MOVIL_POR_DEFECTO}% center`, md: 'center' },
            }}
          />
        )}
        {!conVideo && imagenes?.map((imagen, i) => {
          // Solo se montan la visible, la siguiente (así ya está cargada cuando
          // le toca fundirse) y la anterior, que tiene que seguir debajo
          // mientras la nueva se funde encima. Las demás no gastan red ni
          // memoria hasta que se acerca su turno, por muchas fotos que ponga
          // el CMS.
          const anterior = (actual - 1 + total) % total
          const siguiente = (actual + 1) % total
          if (i !== actual && i !== siguiente && !(tick > 0 && i === anterior)) return null
          const activa = i === actual
          // La primera foto, además de fundirse, se posa desde un zoom ligero: es
          // la entrada de la página. Las demás solo se funden; un zoom en cada
          // cambio de foto cansaría.
          const sePosa = i === 0 && !reduceMotion
          // Solo la primera de la visita compite por la red con lo urgente; las
          // que vienen detrás tienen siete segundos para llegar.
          const primera = i === 0 && tick === 0
          return (
            <Box
              key={`${i}-${imagen.url}`}
              component={m.img}
              // A lo ancho de la pantalla; pero en vertical la foto se recorta por
              // los lados para llenar el alto, y lo que manda es ese alto (una
              // foto apaisada necesita ~1,5 veces el alto de ancho).
              {...propsDeFoto(imagen.url, '(orientation: portrait) 150vh, 100vw', () => setRotas((r) => new Set(r).add(imagen.url)))}
              alt={imagen.descripcion}
              aria-hidden={activa ? undefined : true}
              fetchPriority={primera ? 'high' : 'low'}
              loading={primera ? 'eager' : 'lazy'}
              decoding="async"
              // El zoom va en `transform`, no en `scale`: así lo hace la tarjeta
              // gráfica y no da tirones mientras se monta el resto de la portada.
              initial={{ opacity: 0, ...(sePosa ? { transform: `scale(${ZOOM_DE_ENTRADA})` } : {}) }}
              // La que entra se funde por encima; la que sale espera tapada a que
              // termine el fundido y se apaga de golpe. Si las dos se fundieran a
              // la vez, a mitad se vería el fondo oscuro a través de ambas.
              animate={{ opacity: activa ? OPACIDAD_FOTO : 0, ...(sePosa ? { transform: 'scale(1)' } : {}) }}
              transition={activa
                ? { opacity: { duration: FUNDIDO_S, ease: 'easeInOut' }, transform: { duration: POSADO_S, ease: CURVA_ENTRADA } }
                : { duration: 0, delay: FUNDIDO_S }}
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                // Por debajo del PC la cabecera es vertical y la foto se recorta
                // por los lados: cada una dice en el CMS qué parte se queda.
                objectPosition: { xs: `${imagen.encuadre ?? ENCUADRE_MOVIL_POR_DEFECTO}% center`, md: 'center' },
                zIndex: activa ? 2 : 1,
              }}
            />
          )
        })}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: {
            // Por debajo del PC, el título va arriba y los botones abajo: se
            // oscurecen solo los dos extremos y el centro queda limpio para la
            // cara, que es lo que más se tapaba.
            xs: 'linear-gradient(to bottom, rgba(7,6,8,.85) 0%, rgba(7,6,8,.35) 24%, transparent 38%), linear-gradient(to top, #121113 0%, rgba(7,6,8,.7) 12%, transparent 26%)',
            md: 'linear-gradient(to top, #121113 0%, rgba(7,6,8,.76) 18%, rgba(7,6,8,.12) 65%), linear-gradient(to left, rgba(7,6,8,.38), transparent 70%)',
          },
        }}
      />

      {(conVideo || rotan) && (
        <IconButton
          onClick={alternarPausa}
          aria-label={conVideo
            ? (pausado ? 'Reanudar el vídeo de fondo' : 'Pausar el vídeo de fondo')
            : (pausado ? 'Reanudar el pase de fotos' : 'Pausar el pase de fotos')}
          sx={{
            position: 'absolute',
            zIndex: 3,
            // En el móvil, abajo a la derecha: arriba va el título, y los dos
            // botones dejan libre ese rincón. En escritorio, arriba a la
            // derecha (abajo a la izquierda va la cuenta atrás), por debajo
            // de la barra fija, que tapa los primeros 72 px.
            top: { xs: 'auto', md: 96 },
            bottom: { xs: 24, md: 'auto' },
            right: { xs: 16, md: 28 },
            width: 40,
            height: 40,
            color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.3)',
            bgcolor: 'rgba(7,6,8,0.35)',
            '&:hover': { bgcolor: 'rgba(7,6,8,0.6)', color: '#fff' },
          }}
        >
          {pausado ? <PlayArrowRoundedIcon fontSize="small" /> : <PauseRoundedIcon fontSize="small" />}
        </IconButton>
      )}
      <CuentaAtrasDeSalida forma="hero" />
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          // A la derecha en pantallas anchas, junto a la foto; en el móvil, a la
          // izquierda, que es como se lee un párrafo de varias líneas.
          textAlign: { xs: 'left', md: 'right' },
          width: '100%',
          // Por debajo del PC ocupa todo el alto: el título arriba y los
          // botones al pie, con la foto libre en medio.
          height: { xs: '100%', md: 'auto' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'space-between', md: 'flex-end' },
          alignItems: { xs: 'flex-start', md: 'flex-end' },
          pt: { xs: 3.5, md: 0 },
          pb: { xs: 3.5, md: 8 },
          // Mismo margen lateral que el logo de la barra de navegación
          px: { xs: '20px', md: '40px', xl: '48px' },
        }}
      >
        {/* Los textos entran en cascada nada más montarse (no al entrar en vista:
            el hero ya está a la vista), con el título asomando por su cortina.
            En dos grupos: por debajo del PC, uno va arriba y el otro al pie. */}
        <Box sx={GRUPO}>
          <Revela alMontar retraso={RETRASO_TEXTOS_S}>
            <Typography variant="overline" sx={{ color: '#ded3bd', letterSpacing: '0.2em', fontSize: { xs: 11, md: 12 }, mb: 2 }}>
              <TextoDePortada anchos={['14em']}>{textos.hero.ceja}</TextoDePortada>
            </Typography>
          </Revela>
          <Revela alMontar efecto="cortina" retraso={RETRASO_TEXTOS_S} orden={1}>
            <Typography
              id="hero-title"
              variant="h1"
              component={enVistaPrevia ? 'p' : 'h1'}
              sx={{
                color: 'text.primary',
                mb: { xs: 0, md: 2.5 },
                fontSize: { xs: '38px', sm: '50px', md: '64px' },
                maxWidth: '780px',
                textWrap: 'balance',
                textShadow: '0 2px 24px rgba(0,0,0,.2)',
              }}
            >
              <TextoDePortada anchos={['9em']}>{textos.hero.titulo}</TextoDePortada>
            </Typography>
          </Revela>
        </Box>
        <Box sx={GRUPO}>
          <Revela alMontar retraso={RETRASO_TEXTOS_S} orden={2}>
            <Typography
              variant="body1"
              sx={{
                // En el móvil no cabe sin volver a tapar la cara: lo dicen ya el título y los botones.
                display: { xs: 'none', sm: 'block' },
                color: 'text.secondary',
                maxWidth: '510px',
                ml: { xs: 0, md: 'auto' },
                mb: 3.5,
                fontSize: { xs: '16px', md: '18px' },
              }}
            >
              <TextoDePortada anchos={['26em', '18em']}>{textos.hero.parrafo}</TextoDePortada>
            </Typography>
          </Revela>
          <Revela alMontar retraso={RETRASO_TEXTOS_S} orden={3}>
            {/* Con vídeo o fotos que rotan, el rincón de la derecha es de su botón de pausa. */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', gap: { xs: 1.5, md: 3 }, pr: { xs: conVideo || rotan ? 7 : 0, md: 0 } }}>
              <Boton component={Link} to="/historia" sx={{ px: { xs: 2.5, md: 3.5 }, fontSize: { xs: 14, md: 15 } }}>
                <TextoDePortada anchos={['8em']}>{textos.hero.botonPrincipal}</TextoDePortada>
              </Boton>
              {/* Las noticias ya vienen justo debajo del hero; la segunda acción lleva a lo que más se consulta.
                  Sin la Agenda no hay otro destino que no repita el botón principal: no se pinta. */}
              {conAgenda && (
                <Box component={Link} to="/agenda" sx={{ ...enlaceConFlecha, color: '#e4e2df' }}>
                  <TextoDePortada anchos={['8em']}>{textos.hero.enlaceSecundario}</TextoDePortada> <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </Box>
              )}
            </Box>
          </Revela>
        </Box>
      </Box>
    </Box>
  )
}

/** Cada grupo de textos se alinea como el bloque: a la izquierda en el móvil, a la derecha en el PC. */
const GRUPO = { display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', md: 'flex-end' } } as const
