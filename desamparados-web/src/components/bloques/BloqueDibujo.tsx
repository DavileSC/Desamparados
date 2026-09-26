import { useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { SERIF } from '../../features/inicio/estilos'
import { limpiarHtml } from '../../lib/limpiarHtml'
import { useModoEdicion } from './modoEdicion'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueDibujo as Datos, NombreDeDibujo } from '../../lib/api/contenido'

/**
 * Un dibujo de líneas que se traza al bajar por la página, con un texto al
 * lado. Cada trazo empieza cuando acaba el anterior, así que el dibujo se
 * levanta en orden: primero el suelo, luego la silueta, al final la cruz. Si
 * se sube, se deshace.
 *
 * El dibujo toma el color de acento de la franja (oro sobre oscuro, granate
 * sobre papel). Con «reducir movimiento», o en la vista del constructor, sale
 * ya dibujado.
 *
 * Con ilustración (`foto`), se pinta ella en lugar del dibujo de líneas: se
 * enciende sola al aparecer, sobre un filete de oro que se tiende debajo.
 *
 * Pinta su propio título (ver `pintaSuTitulo` en `registro.tsx`): va en la
 * columna del texto y no encima de los dos.
 */
export default function BloqueDibujo({ bloque }: { bloque: Datos }) {
  const marco = useRef<HTMLDivElement>(null)
  const reducir = useReducedMotion()
  const enConstructor = useModoEdicion() !== null
  const { scrollYProgress } = useScroll({ target: marco, offset: ['start 85%', 'center 40%'] })
  const derecha = valorDe(bloque, 'ladoDibujo') === 'derecha'
  const Dibujo = DIBUJOS[bloque.dibujo]
  const foto = bloque.foto?.url ? bloque.foto : null
  if (!Dibujo && !foto) return null
  const quieto = reducir || enConstructor
  // Una ilustración es apaisada: se le da más ancho que al dibujo, que es casi cuadrado.
  const imagen = foto ? 'minmax(0, 1.3fr)' : 'minmax(0, 1.15fr)'
  const texto = 'minmax(0, 1fr)'

  return (
    <Box sx={{
      maxWidth: anchoMaximo(bloque, '1150px'), mx: 'auto',
      display: 'grid', alignItems: 'center', gap: { xs: 4, md: 9 },
      gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: derecha ? `${texto} ${imagen}` : `${imagen} ${texto}` },
      gridTemplateAreas: { xs: '"dibujo" "texto"', md: derecha ? '"texto dibujo"' : '"dibujo texto"' },
    }}>
      <Box ref={marco} sx={{ gridArea: 'dibujo', color: 'secondary.main', maxWidth: foto ? 'none' : { xs: 320, md: 440 }, width: '100%', mx: 'auto' }}>
        {foto
          ? <Ilustracion url={foto.url} alt={foto.alt} quieto={quieto} />
          : <Dibujo avance={scrollYProgress} quieto={quieto} />}
      </Box>
      <Box sx={{ gridArea: 'texto', minWidth: 0 }}>
        {bloque.titulo && (
          <Typography component="h2" sx={{ fontFamily: SERIF, fontSize: { xs: 34, md: 46 }, lineHeight: 1.1, letterSpacing: '-0.015em', color: 'text.primary', mb: 3 }}>
            {bloque.titulo}
          </Typography>
        )}
        <Box
          sx={{
            color: 'text.secondary', fontSize: { xs: 16, md: 17 }, lineHeight: 1.8, maxWidth: '60ch',
            '& p': { mb: 2.5 }, '& strong': { color: 'text.primary', fontWeight: 600 },
            '& h2, & h3': { color: 'text.primary', mt: 3, mb: 1.5 },
            '& > :first-child': { mt: 0 }, '& > :last-child': { mb: 0 },
          }}
          dangerouslySetInnerHTML={{ __html: limpiarHtml(bloque.html) }}
        />
      </Box>
    </Box>
  )
}

/** Lo que tarda la ilustración en encenderse del todo. */
const ENCENDIDO = 5

/**
 * La ilustración que sustituye al dibujo: aparece apagada, como de noche, y se
 * enciende sola en unos segundos —brillo y color—, mientras se tiende debajo
 * el filete de oro del suelo.
 *
 * Por tiempo y no por scroll: la del templo es lo primero que se ve al abrir
 * la página, y atada al scroll se iría de la pantalla antes de encenderse.
 * Empieza cuando está a la vista, así que más abajo en una página también
 * se ve encenderse.
 */
function Ilustracion({ url, alt, quieto }: { url: string; alt: string; quieto: boolean }) {
  const marco = useRef<HTMLDivElement>(null)
  const aLaVista = useInView(marco, { once: true, amount: 0.3 })
  const encendida = quieto || aLaVista
  // Repartido por igual en todo el tiempo: con una curva que frena pronto, casi
  // todo el cambio se iba en el primer segundo y el resto no se notaba.
  const transicion = { duration: ENCENDIDO, ease: [0.45, 0.05, 0.4, 1] as const }
  return (
    <Box ref={marco} sx={{ position: 'relative', pb: 2 }}>
      <Box component={motion.img} src={url} alt={alt} loading="eager" decoding="async"
        initial={quieto ? false : { filter: 'brightness(0.3) saturate(0.3)' }}
        animate={encendida ? { filter: 'brightness(1) saturate(1)' } : undefined}
        transition={transicion}
        sx={{ display: 'block', width: '100%', height: 'auto' }} />
      <Box component={motion.div} aria-hidden
        initial={quieto ? false : { scaleX: 0.15 }}
        animate={encendida ? { scaleX: 1 } : undefined}
        transition={transicion}
        sx={{ position: 'absolute', left: '4%', right: '4%', bottom: 0, height: '1px', backgroundColor: 'secondary.main', transformOrigin: 'center' }} />
    </Box>
  )
}

/** Lo que recibe un dibujo: cuánto se ha bajado por él, de 0 a 1, y si va dibujado entero y quieto. */
type PropsDibujo = { avance: MotionValue<number>; quieto: boolean }

/**
 * Un trazo que se dibuja en su tramo del avance: `desde` y `hasta` son la
 * parte del recorrido (de 0 a 1) en la que se traza.
 */
function Trazo({ d, avance, quieto, desde, hasta, grueso = 1.6 }: PropsDibujo & { d: string; desde: number; hasta: number; grueso?: number }) {
  const largo = useTransform(avance, [desde, hasta], [0, 1], { clamp: true })
  // Sin trazar, oculto del todo: con largo 0 el remate redondo aún pintaría un punto.
  const opacidad = useTransform(largo, (v) => (v > 0 ? 1 : 0))
  return (
    <motion.path d={d} fill="none" stroke="currentColor" strokeWidth={grueso} strokeLinecap="round" strokeLinejoin="round"
      style={quieto ? undefined : { pathLength: largo, opacity: opacidad }} />
  )
}

/** Unos trazos repartidos por igual hasta `hasta`, dejando lo que queda para lo que aparece después. */
/**
 * Sin `vector-effect: non-scaling-stroke`: con él, el trazo discontinuo se mide
 * en píxeles de pantalla y no en el largo normalizado del camino, y el dibujo
 * se quedaba a medias. El grueso va, pues, en unidades del dibujo: cada uno
 * da el suyo según su tamaño.
 */
function Trazos({ trazos, hasta = 1, grueso: fino = 1.6, ...dibujo }: PropsDibujo & { trazos: (string | [string, number])[]; hasta?: number; grueso?: number }) {
  const tramo = hasta / trazos.length
  return (
    <>
      {trazos.map((trazo, i) => {
        const [d, grueso] = typeof trazo === 'string' ? [trazo, fino] : trazo
        // Cada trazo se solapa un poco con el siguiente: el dibujo no se para entre uno y otro.
        return <Trazo key={i} {...dibujo} d={d} grueso={grueso} desde={i * tramo} hasta={Math.min(hasta, (i + 1.6) * tramo)} />
      })}
    </>
  )
}

function Lienzo({ viewBox, etiqueta, children }: { viewBox: string; etiqueta: string; children: ReactNode }) {
  return (
    <Box component="svg" viewBox={viewBox} role="img" aria-label={etiqueta} sx={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
      {children}
    </Box>
  )
}

/**
 * El templo de Santa María Goretti, evocado: la estructura triangular sin
 * columnas, con forma de concha y lucernas circulares (Verdú, 1981). No es un
 * alzado: hasta que haya fotos del templo, es su silueta.
 */
function Templo(dibujo: PropsDibujo) {
  return (
    <Lienzo viewBox="0 0 400 320" etiqueta="Dibujo del templo de Santa María Goretti: una estructura triangular en forma de concha, con lucernas circulares y una cruz en lo alto">
      <Trazos {...dibujo} trazos={[
        'M20 292 H380',
        ['M52 292 C112 252 172 152 200 38 C228 152 288 252 348 292', 2],
        'M200 38 Q160 170 96 292',
        'M200 38 Q182 170 150 292',
        'M200 38 Q218 170 250 292',
        'M200 38 Q240 170 304 292',
        'M176 292 V250 Q200 226 224 250 V292',
        'M150 300 H250',
        'M200 108 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0',
        'M165 188 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0',
        'M235 188 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0',
        ['M200 38 V6 M189 17 H211', 2],
      ]} />
    </Lienzo>
  )
}

/**
 * El signo pasionista: el corazón con el lema «Jesu XPI Passio» (la Pasión de
 * Jesucristo), la cruz encima y los tres clavos debajo. El lema aparece al
 * final, cuando el corazón está cerrado.
 */
function SignoPasionista(dibujo: PropsDibujo) {
  const lema = useTransform(dibujo.avance, [0.72, 0.95], [0, 1], { clamp: true })
  return (
    <Lienzo viewBox="0 0 240 300" etiqueta="El signo pasionista: un corazón con el lema Jesu XPI Passio, una cruz encima y tres clavos">
      <Trazos {...dibujo} hasta={0.8} grueso={0.9} trazos={[
        ['M120 282 C60 237 22 192 22 146 C22 106 50 79 80 79 C100 79 113 91 120 105 C127 91 140 79 160 79 C190 79 218 106 218 146 C218 192 180 237 120 282 Z', 1.2],
        'M120 267 C68 227 34 187 34 147 C34 113 57 91 82 91 C99 91 112 102 120 117 C128 102 141 91 158 91 C183 91 206 113 206 147 C206 187 172 227 120 267 Z',
        ['M120 79 V10 M98 32 H142', 1.2],
        'M104 224 L118 254 M99 226 L109 221',
        'M120 222 V257 M114 222 H126',
        'M136 224 L122 254 M131 221 L141 226',
      ]} />
      <motion.g style={dibujo.quieto ? undefined : { opacity: lema }} fill="currentColor" fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle" letterSpacing="4">
        <text x="120" y="152" fontSize="21">JESU</text>
        <text x="120" y="180" fontSize="21">XPI</text>
        <text x="120" y="208" fontSize="21">PASSIO</text>
      </motion.g>
    </Lienzo>
  )
}

const DIBUJOS: Record<NombreDeDibujo, (props: PropsDibujo) => ReactNode> = {
  templo: Templo,
  signoPasionista: SignoPasionista,
}
