import { Box, Typography, useMediaQuery } from '@mui/material'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { m, useInView, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useModoEdicion } from './modoEdicion'
import { GOLD, GRANATE, SERIF, ceja } from '../../features/inicio/estilos'
import { parrafosDe, type BloqueCronologia as Datos, type HitoHistoria } from '../../lib/api/contenido'
import { idDeHito } from './cronologia'
import { valorDe } from './presentacion'
import { caerALaOriginal, propsDeFoto, srcsetDeSubida } from '../../lib/fotoSubida'
import { MARCA, alfa } from '../../theme/marca'

/** El fondo de la página: el hueco del punto del raíl se rellena con él. */
const FONDO = '#121113'
const FILETE = 'rgba(204, 196, 201, 0.22)'
/** Rosa claro del tema (`primary.light`): el granate puro no se lee sobre tinta. */
const GRANATE_CLARO = MARCA.principalClaro

/** Lo que separa un hito del siguiente; la línea del raíl lo cruza. */
const HUECO = { xs: 7, md: 11 } as const
/** Dónde está el punto del raíl respecto al alto del periodo. */
const PUNTO_TOP = { xs: 14, md: 20 } as const
/** El mismo PUNTO_TOP en píxeles, para las cuentas del raíl (md desde 900 px, como el tema). */
const puntoTopPx = () => (window.innerWidth >= 900 ? PUNTO_TOP.md : PUNTO_TOP.xs)
/** La línea de lectura: a qué altura de la pantalla (0 arriba, 1 abajo) se enciende cada época. */
const LINEA_DE_LECTURA = 0.6
/** Safari aún no avisa de cuándo para el scroll: allí se da por parado tras un respiro. */
const HAY_SCROLLEND = typeof window !== 'undefined' && 'onscrollend' in window
/** El oro apagado con el que arranca el relleno del raíl. */
const GOLD_SUAVE = MARCA.acentoApagado
/** El punto encendido de un hito sin tono, y su halo. */
const PUNTO_ENCENDIDO = { backgroundColor: GOLD, borderColor: GOLD }
const HALO_ORO = alfa(MARCA.acento, .14)

/** Color del periodo y del punto de cada hito según su tono. */
const TONOS = {
  ninguno: null,
  granate: { texto: GRANATE_CLARO, punto: { backgroundColor: GRANATE, borderColor: GRANATE_CLARO }, halo: alfa(MARCA.principalClaro, .14) },
  oro: { texto: GOLD, punto: { backgroundColor: GOLD, borderColor: GOLD }, halo: HALO_ORO },
} as const

/**
 * La cronología: los hitos en orden, con el periodo a un lado, un raíl que los
 * une y el relato al otro.
 *
 * Nació dentro de la página de Historia y salió de ella al pasar Historia al
 * constructor de páginas: así se edita como un bloque más y se puede poner en
 * cualquier otra página. Historia la sigue envolviendo en su franja de tinta
 * velada; en las demás va tal cual, sobre el fondo de la página.
 *
 * `conAnclas` pone a cada hito el id al que enlaza el índice de la cabecera de
 * Historia. Solo lo pide Historia, y solo para su primera cronología: dos
 * bloques con anclas repetirían ids.
 */
export default function BloqueCronologia({ bloque, conAnclas = false }: { bloque: Datos; conAnclas?: boolean }) {
  const disposicion = valorDe(bloque, 'disposicion')
  if (disposicion === 'cinta') return <CronologiaCinta bloque={bloque} conAnclas={conAnclas} />
  if (disposicion === 'horizontal') return <CronologiaHorizontal bloque={bloque} conAnclas={conAnclas} />
  return <CronologiaVertical bloque={bloque} conAnclas={conAnclas} />
}

/**
 * La cronología en vertical, con el raíl vivo: según se baja, el raíl se va
 * llenando de oro, cada época se enciende cuando su punto cruza la línea de
 * lectura y el periodo acompaña mientras se lee un relato largo. Todo sigue al
 * scroll: si se sube, se vuelve a apagar.
 *
 * Con «reducir movimiento», o en la vista en vivo del constructor, sale todo
 * encendido y quieto, como era antes.
 */
function CronologiaVertical({ bloque, conAnclas }: { bloque: Datos; conAnclas: boolean }) {
  const lista = useRef<HTMLOListElement>(null)
  const reducir = useReducedMotion()
  const enConstructor = useModoEdicion() !== null
  const vivo = !reducir && !enConstructor

  // Hasta dónde llega el relleno: del primer punto al último. Se mide, porque
  // el último hito puede ser tan largo como quiera y el raíl acaba en su punto.
  const [largo, setLargo] = useState(0)
  useLayoutEffect(() => {
    const ol = lista.current
    if (!ol) return
    const mide = () => {
      const puntos = ol.querySelectorAll<HTMLElement>('[data-punto]')
      if (puntos.length === 0) return
      setLargo(puntos[puntos.length - 1].getBoundingClientRect().top - puntos[0].getBoundingClientRect().top)
    }
    mide()
    const observador = new ResizeObserver(mide)
    observador.observe(ol)
    return () => observador.disconnect()
  }, [bloque.hitos.length])

  // Cuánto del raíl queda por encima de la línea de lectura, de 0 a 1.
  const { scrollY } = useScroll()
  const llenado = useTransform(scrollY, () => {
    const ol = lista.current
    if (!ol || largo === 0) return 0
    const primerPunto = ol.getBoundingClientRect().top + puntoTopPx()
    return Math.min(1, Math.max(0, (window.innerHeight * LINEA_DE_LECTURA - primerPunto) / largo))
  })
  const escala = useSpring(llenado, { stiffness: 120, damping: 24, mass: 0.4 })

  // De época en época: al parar de hacer scroll, si el principio de la época
  // siguiente —en la dirección en que se iba— queda a menos de un tercio de
  // pantalla, la página se desliza hasta él, con su año bajo la barra. Nunca
  // tira hacia atrás: dentro de una época más larga que la pantalla se lee
  // bajando con normalidad. (El scroll-snap del navegador se probó y no sirve:
  // en una época larga devolvía cada ruedazo al principio y no se avanzaba.)
  // En el constructor no, que se edita dentro.
  useEffect(() => {
    const ol = lista.current
    if (enConstructor || !ol) return
    let ultimaY = window.scrollY
    let direccion = 0
    let propio = false
    let espera = 0
    const alParar = () => {
      if (propio) { propio = false; return }
      const caja = ol.getBoundingClientRect()
      // Solo con la cronología en pantalla.
      if (caja.bottom < 0 || caja.top > window.innerHeight || direccion === 0) return
      const umbral = window.innerHeight / 3
      let mejor: number | null = null
      for (const li of ol.children as HTMLCollectionOf<HTMLElement>) {
        const margen = parseFloat(getComputedStyle(li).scrollMarginTop) || 0
        const d = li.getBoundingClientRect().top - margen
        if (Math.abs(d) < 2) return // ya está en una época
        const hacia = direccion > 0 ? d > 0 && d <= umbral : d < 0 && d >= -umbral
        if (hacia && (mejor === null || Math.abs(d) < Math.abs(mejor))) mejor = d
      }
      if (mejor === null) return
      propio = true
      window.scrollBy({ top: mejor, behavior: reducir ? 'auto' : 'smooth' })
    }
    const alMover = () => {
      const y = window.scrollY
      if (y !== ultimaY) direccion = Math.sign(y - ultimaY)
      ultimaY = y
      // Donde no hay «scrollend» (Safari), se da por parado tras un respiro.
      window.clearTimeout(espera)
      if (!HAY_SCROLLEND) espera = window.setTimeout(alParar, 160)
    }
    window.addEventListener('scroll', alMover, { passive: true })
    window.addEventListener('scrollend', alParar)
    return () => {
      window.removeEventListener('scroll', alMover)
      window.removeEventListener('scrollend', alParar)
      window.clearTimeout(espera)
    }
  }, [enConstructor, reducir])

  return (
    <Box sx={{ position: 'relative', maxWidth: 1072, mx: 'auto' }}>
      {vivo && largo > 0 && (
        <Box
          component={m.div}
          aria-hidden="true"
          style={{ scaleY: escala, x: '-50%' }}
          sx={{
            position: 'absolute',
            // El eje del raíl: el centro de su columna (200 + 40 de hueco + 20 en escritorio; 12 en móvil).
            left: { xs: 12, md: 260 },
            top: PUNTO_TOP,
            height: largo,
            width: '2px',
            transformOrigin: 'top',
            // Encima del filete gris, debajo de los puntos.
            zIndex: 1,
            background: `linear-gradient(${GOLD_SUAVE}, ${GOLD})`,
            pointerEvents: 'none',
          }}
        />
      )}
      <Box component="ol" ref={lista} aria-label={bloque.titulo || 'Cronología'} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {bloque.hitos.map((hito, indice) => (
          <HitoDeLaLinea
            // Clave posicional: un hito no tiene identificador, y ninguno de sus
            // elementos guarda estado propio que pudiera quedarse en otra fila.
            key={indice}
            hito={hito}
            id={conAnclas ? idDeHito(indice) : undefined}
            primero={indice === 0}
            ultimo={indice === bloque.hitos.length - 1}
            vivo={vivo}
          />
        ))}
      </Box>
    </Box>
  )
}

interface HitoDeLaLineaProps {
  hito: HitoHistoria
  id?: string
  primero: boolean
  ultimo: boolean
  vivo: boolean
}

/**
 * Un hito de la cronología: el periodo, el raíl con su punto y el cuerpo. En
 * escritorio van en tres columnas; en móvil el periodo pasa encima del texto
 * y el raíl se pega al margen izquierdo.
 */
function HitoDeLaLinea({ hito, id, primero, ultimo, vivo }: HitoDeLaLineaProps) {
  const tono = TONOS[hito.tono] ?? null
  const parrafos = parrafosDe(hito.relato)

  // Encendido cuando su punto ha cruzado la línea de lectura; apagado otra vez
  // si se sube y el punto vuelve a quedar por debajo.
  const punto = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: punto, offset: [`start ${LINEA_DE_LECTURA * 100}%`, `end ${LINEA_DE_LECTURA * 100}%`] })
  const [alcanzado, setAlcanzado] = useState(false)
  useMotionValueEvent(scrollYProgress, 'change', (p) => setAlcanzado(p > 0))
  const encendido = !vivo || alcanzado
  const transicion = 'opacity .7s ease, transform .7s ease, color .5s ease'

  return (
    <Box
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '24px minmax(0, 1fr)', md: '200px 40px minmax(0, 1fr)' },
        gridTemplateAreas: { xs: '"rail periodo" "rail cuerpo"', md: '"periodo rail cuerpo"' },
        columnGap: { xs: 2.5, md: 5 },
        rowGap: { xs: 2, md: 0 },
        pb: ultimo ? 0 : HUECO,
        // El año queda justo bajo la barra fija al ajustarse (y al saltar desde el índice).
        scrollMarginTop: { xs: 80, md: 104 },
      }}
      id={id}
    >
      {/* En escritorio el periodo se queda a la vista mientras se lee su relato. */}
      <Box sx={{ gridArea: 'periodo', textAlign: { md: 'right' }, pt: { md: '6px' }, alignSelf: 'start', position: { md: 'sticky' }, top: { md: 112 } }}>
        <Typography
          component="span"
          sx={{
            display: 'block', fontFamily: SERIF, fontSize: { xs: 40, md: 52 }, lineHeight: 1, letterSpacing: '-0.02em',
            color: encendido ? tono?.texto ?? '#fff' : 'rgba(255, 255, 255, 0.4)',
            transition: transicion,
          }}
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
          ref={punto}
          data-punto
          sx={{
            position: 'absolute',
            left: '50%',
            top: PUNTO_TOP,
            width: 13,
            height: 13,
            zIndex: 2,
            transform: `translateX(-50%) scale(${vivo && alcanzado ? 1.15 : 1})`,
            borderRadius: '50%',
            boxSizing: 'border-box',
            border: '2px solid #cbc5c8',
            backgroundColor: FONDO,
            transition: 'background-color .4s, border-color .4s, transform .4s, box-shadow .6s',
            ...tono?.punto,
            // Encendido, el punto se rellena (de oro si el hito no tiene tono) y echa un halo.
            ...(vivo && alcanzado ? { ...(tono?.punto ?? PUNTO_ENCENDIDO), boxShadow: `0 0 0 6px ${tono?.halo ?? HALO_ORO}` } : {}),
          }}
        />
      </Box>

      <Box sx={{ gridArea: 'cuerpo', opacity: encendido ? 1 : 0.38, transform: encendido ? 'none' : 'translateY(14px)', transition: transicion }}>
        {/* h3: el bloque cuelga de un h2 (su título, o el oculto «Cronología»
            de Historia), y cada hito es una parte de él. */}
        <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 30 }, lineHeight: 1.2, letterSpacing: '-0.01em', mb: 2 }}>
          {hito.titulo}
        </Typography>
        {parrafos.map((parrafo, indice) => (
          <Typography key={indice} sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 17 }, lineHeight: 1.75, maxWidth: '56ch', mb: 2.75, '&:last-of-type': { mb: 0 } }}>
            {parrafo}
          </Typography>
        ))}
        {hito.foto.url !== '' && (
          <Box sx={{ mt: 4 }}>
            <FotoDelHito url={hito.foto.url} alt={hito.foto.alt} vivo={vivo} />
            {hito.foto.pie !== '' && (
              <Typography component="span" sx={{ ...ceja, mb: 0, mt: 1.75, fontSize: 12, letterSpacing: '0.12em' }}>
                {hito.foto.pie}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * La foto de un hito, que se descubre de izquierda a derecha cuando ella misma
 * entra en la pantalla y ya ha llegado. Antes se descubría con el punto de su
 * época, que va arriba del hito: la foto, debajo de los párrafos, estaba aún
 * fuera de la vista y al bajar ya aparecía descubierta, casi de golpe. Se
 * vuelve a tapar si se sube por encima de ella.
 *
 * La carga diferida la hace este componente y no `loading="lazy"`: Chrome no
 * descarga una imagen diferida mientras el recorte la tapa entera, así que
 * solo empezaba a bajarla al descubrirse y aparecía de golpe al llegar.
 */
function FotoDelHito({ url, alt, vivo }: { url: string; alt: string; vivo: boolean }) {
  const ref = useRef<HTMLImageElement>(null)
  // Se pide con margen, antes de que haga falta, y ya no se suelta.
  const cerca = useInView(ref, { once: true, margin: '800px 0px 800px 0px' })
  // Cuando su parte de arriba pasa del 85 % de la pantalla, con algo ya a la vista.
  const enVista = useInView(ref, { margin: '0px 0px -15% 0px' })
  const [cargada, setCargada] = useState(false)
  // Si ya estaba en la caché del navegador, `load` pudo dispararse antes de pintar.
  useLayoutEffect(() => { if (cerca && ref.current?.complete && ref.current.naturalWidth > 0) setCargada(true) }, [url, cerca])
  const descubierta = !vivo || (enVista && cargada)
  return (
    <Box
      component="img"
      ref={ref}
      src={cerca || !vivo ? url : undefined}
      srcSet={cerca || !vivo ? srcsetDeSubida(url) : undefined}
      sizes="(min-width: 600px) 560px, 100vw"
      onError={(e) => { caerALaOriginal(e.currentTarget) }}
      alt={alt}
      decoding="async"
      onLoad={() => setCargada(true)}
      sx={{
        display: 'block', width: '100%', maxWidth: 560, aspectRatio: '560 / 340', objectFit: 'cover',
        clipPath: descubierta ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
        transition: 'clip-path 1.4s cubic-bezier(.2, .7, .15, 1)',
      }}
    />
  )
}

/**
 * La cronología en horizontal: los hitos en fila sobre un raíl, cada uno en
 * su columna, y la fila se desliza de lado cuando no caben. Para historias
 * cortas o para una franja de fechas; con relatos largos se lee mejor en
 * vertical.
 */
function CronologiaHorizontal({ bloque, conAnclas }: { bloque: Datos; conAnclas: boolean }) {
  return (
    <Box
      component="ol"
      aria-label={bloque.titulo || 'Cronología'}
      sx={{
        listStyle: 'none', m: 0, p: 0, pb: 2,
        display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: '78%', sm: '46%', md: 'minmax(260px, 1fr)' }, gap: { xs: 3, md: 4 },
        overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'thin', scrollbarColor: `${alfa(MARCA.acento, .45)} transparent`,
      }}
    >
      {bloque.hitos.map((hito, indice) => {
        const tono = TONOS[hito.tono] ?? null
        return (
          <Box component="li" key={indice} id={conAnclas ? idDeHito(indice) : undefined} sx={{ scrollSnapAlign: 'start', minWidth: 0 }}>
            <Box aria-hidden sx={{ position: 'relative', height: 13, mb: 3, '&::before': { content: '""', position: 'absolute', top: 6, left: 0, right: { xs: -24, md: -32 }, height: '1px', backgroundColor: FILETE } }}>
              <Box sx={{ position: 'relative', width: 13, height: 13, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid #cbc5c8', backgroundColor: FONDO, ...tono?.punto }} />
            </Box>
            <Typography component="span" sx={{ display: 'block', fontFamily: SERIF, fontSize: { xs: 34, md: 40 }, lineHeight: 1, color: tono?.texto ?? 'text.primary' }}>
              {hito.periodo}
            </Typography>
            <Typography component="span" sx={{ ...ceja, mb: 2, mt: 1, letterSpacing: '0.22em' }}>{hito.etiqueta}</Typography>
            {hito.foto.url !== '' && (
              <Box component="img" {...propsDeFoto(hito.foto.url, '(min-width: 900px) 500px, 100vw')} alt={hito.foto.alt} loading="lazy" decoding="async"
                sx={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', mb: 2 }} />
            )}
            <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 22, md: 24 }, lineHeight: 1.25, mb: 1.5 }}>{hito.titulo}</Typography>
            {parrafosDe(hito.relato).map((parrafo, i) => (
              <Typography key={i} sx={{ color: 'text.secondary', fontSize: 15.5, lineHeight: 1.7, mb: 1.5, '&:last-of-type': { mb: 0 } }}>{parrafo}</Typography>
            ))}
          </Box>
        )
      })}
    </Box>
  )
}

/**
 * La cronología en cinta: al bajar por la página, la cinta se queda fija en la
 * pantalla y los hitos pasan de derecha a izquierda, mientras un filete de oro
 * cuenta lo recorrido. Cuando se acaba la cinta, la página sigue.
 *
 * En el móvil, con «reducir movimiento» o en la vista del constructor es la
 * horizontal de siempre, que se desliza con el dedo: fijar la pantalla en un
 * móvil se siente como si el scroll se hubiera atascado. También cuando los
 * hitos no caben de alto en la pantalla (relatos largos, una pantalla baja):
 * fija, la cinta cortaba lo que sobraba por abajo y no había forma de leerlo.
 */
function CronologiaCinta({ bloque, conAnclas }: { bloque: Datos; conAnclas: boolean }) {
  const reducir = useReducedMotion()
  const enConstructor = useModoEdicion() !== null
  const escritorio = useMediaQuery('(min-width: 900px)', { noSsr: true })
  const [noCabe, setNoCabe] = useState(false)
  const alNoCaber = useCallback(() => setNoCabe(true), [])
  if (reducir || enConstructor || !escritorio || noCabe) return <CronologiaHorizontal bloque={bloque} conAnclas={conAnclas} />
  return <CintaViva bloque={bloque} conAnclas={conAnclas} onNoCabe={alNoCaber} />
}

/** El periodo, más pequeño cuanto más largo: a 88 px, «Años cincuenta» se salía de su columna. */
const tamanoDelPeriodo = (periodo: string) => (periodo.length <= 5 ? 88 : periodo.length <= 9 ? 64 : 44)

/** El ancho de cada hito de la cinta y el hueco entre dos. */
const ANCHO_HITO = 360
const HUECO_CINTA = 72

function CintaViva({ bloque, conAnclas, onNoCabe }: { bloque: Datos; conAnclas: boolean; onNoCabe: () => void }) {
  const tramo = useRef<HTMLDivElement>(null)
  const fila = useRef<HTMLOListElement>(null)
  // Lo que la cinta mide de más respecto a la ventana: es lo que tiene que
  // desplazarse, y lo que se añade de alto al tramo para recorrerlo bajando.
  const [sobra, setSobra] = useState(0)
  useLayoutEffect(() => {
    const ol = fila.current
    if (!ol) return
    const mide = () => {
      setSobra(Math.max(0, ol.scrollWidth - window.innerWidth))
      // Lo que queda de alto bajo el margen de arriba y el filete de lo recorrido.
      const util = window.innerHeight - Math.max(120, window.innerHeight * 0.16) - 64
      if (ol.offsetHeight > util) onNoCabe()
    }
    mide()
    const observador = new ResizeObserver(mide)
    observador.observe(ol)
    window.addEventListener('resize', mide)
    return () => { observador.disconnect(); window.removeEventListener('resize', mide) }
  }, [bloque.hitos.length, onNoCabe])

  const { scrollYProgress } = useScroll({ target: tramo, offset: ['start start', 'end end'] })
  const x = useSpring(useTransform(scrollYProgress, (v) => -v * sobra), { stiffness: 160, damping: 32, mass: 0.35 })
  const recorrido = useSpring(scrollYProgress, { stiffness: 160, damping: 32, mass: 0.35 })

  return (
    <Box ref={tramo} sx={{ position: 'relative', height: `calc(100svh + ${sobra}px)` }}>
      <Box sx={{
        position: 'sticky', top: 0, height: '100svh', overflow: 'hidden',
        // A sangre, de lado a lado de la ventana, como una franja de fondo.
        mx: 'calc(50% - 50vw)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        // Arriba y no centrada: centrada dejaba un hueco grande bajo el título antes de fijarse.
        pt: 'max(120px, 16svh)',
      }}>
        <Box
          component={m.ol}
          ref={fila}
          aria-label={bloque.titulo || 'Cronología'}
          style={{ x }}
          sx={{
            listStyle: 'none', m: 0, display: 'flex', gap: `${HUECO_CINTA}px`, width: 'max-content',
            // El primer hito arranca alineado con el contenido de la página, y el último acaba igual.
            px: 'max(24px, calc(50vw - 560px))',
          }}
        >
          {bloque.hitos.map((hito, indice) => {
            const tono = TONOS[hito.tono] ?? null
            return (
              <Box component="li" key={indice} id={conAnclas ? idDeHito(indice) : undefined} sx={{ width: ANCHO_HITO, flexShrink: 0 }}>
                <Box aria-hidden sx={{
                  position: 'relative', height: 13, mb: 4,
                  '&::before': { content: '""', position: 'absolute', top: 6, left: 0, right: -HUECO_CINTA, height: '1px', backgroundColor: FILETE },
                }}>
                  <Box sx={{ position: 'relative', width: 13, height: 13, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid #cbc5c8', backgroundColor: FONDO, ...tono?.punto }} />
                </Box>
                <Typography component="span" sx={{ display: 'block', fontFamily: SERIF, fontSize: tamanoDelPeriodo(hito.periodo), lineHeight: 0.9, letterSpacing: '-0.03em', overflowWrap: 'anywhere', color: tono?.texto ?? 'text.primary' }}>
                  {hito.periodo}
                </Typography>
                <Typography component="span" sx={{ ...ceja, mb: 2.5, mt: 2, letterSpacing: '0.22em' }}>{hito.etiqueta}</Typography>
                {hito.foto.url !== '' && (
                  <Box component="img" {...propsDeFoto(hito.foto.url, '(min-width: 900px) 500px, 100vw')} alt={hito.foto.alt} loading="lazy" decoding="async"
                    sx={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', mb: 2.5 }} />
                )}
                <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.2, mb: 1.5 }}>{hito.titulo}</Typography>
                {parrafosDe(hito.relato).map((parrafo, i) => (
                  <Typography key={i} sx={{ color: 'text.secondary', fontSize: 16, lineHeight: 1.7, mb: 1.5, '&:last-of-type': { mb: 0 } }}>{parrafo}</Typography>
                ))}
              </Box>
            )
          })}
        </Box>
        {/* Lo recorrido de la cinta: un filete de oro que se llena al bajar. */}
        <Box aria-hidden sx={{ mt: 6, mx: 'max(24px, calc(50vw - 560px))', height: '2px', backgroundColor: FILETE, overflow: 'hidden' }}>
          <Box component={m.div} style={{ scaleX: recorrido }} sx={{ height: '100%', transformOrigin: 'left', background: `linear-gradient(90deg, ${GOLD_SUAVE}, ${GOLD})` }} />
        </Box>
      </Box>
    </Box>
  )
}
