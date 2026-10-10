import { m, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import { useModoEdicion } from './bloques/modoEdicion'
import { Box, type SxProps, type Theme } from '@mui/material'
import { CURVA_ENTRADA } from './entrada'

// Separación entre elementos de una misma cascada.
const PASO = 0.12
// El elemento arranca cuando ya ha entrado un 12 % del alto de la pantalla: así la
// entrada se ve entera, y no a medias por el borde de abajo.
const VIEWPORT = { once: true, margin: '0px 0px -12% 0px' } as const

/**
 * De dónde parte cada elemento y cuánto tarda en posarse. Cuatro entradas, y
 * cada una para un tipo de cosa, para que la portada no parezca una feria:
 * - subir: textos, enlaces y lo que no sea nada de lo de abajo.
 * - crecer: tarjetas y objetos (noticias, la agenda, los boletines, las teselas).
 * - cortina: titulares grandes: el texto asoma por detrás de una línea invisible.
 * - desvelar: placas y fotos: se descubren de izquierda a derecha, sin fundido.
 *
 * El movimiento va en `transform` y no en `y`/`scale`: framer-motion solo pasa
 * a la tarjeta gráfica opacity, clipPath, filter y transform; `y` y `scale` los
 * calcula cuadro a cuadro en el hilo principal. En los primeros segundos ese
 * hilo está montando la página y las entradas iban a tirones.
 *
 * Se anima hasta el valor neutro escrito (`translateY(0px) scale(1)`) y ahí se
 * queda: framer-motion convierte cualquier `none` (también en `transitionEnd`)
 * en las mismas funciones a cero, y las tarjetas acababan en `scale(0)`,
 * invisibles. Por eso nada que vaya `position: fixed` debe ir dentro de un
 * Revela: el transform que queda le haría de caja de referencia.
 */

const EFECTOS = {
  subir: { oculto: { opacity: 0, transform: 'translateY(40px)' }, visible: { opacity: 1, transform: 'translateY(0px)' }, duracion: 1 },
  crecer: { oculto: { opacity: 0, transform: 'translateY(48px) scale(0.94)' }, visible: { opacity: 1, transform: 'translateY(0px) scale(1)' }, duracion: 1.1 },
  cortina: { oculto: { opacity: 0, transform: 'translateY(115%)' }, visible: { opacity: 1, transform: 'translateY(0%)' }, duracion: 1.1 },
  desvelar: { oculto: { clipPath: 'inset(0 100% 0 0)' }, visible: { clipPath: 'inset(0 0 0 0)' }, duracion: 1.2 },
} satisfies Record<string, { oculto: TargetAndTransition; visible: TargetAndTransition; duracion: number }>

export type Efecto = keyof typeof EFECTOS

// La máscara de la cortina: recorta solo por abajo, y un poco más allá de la
// caja para no comerse los descendentes de la serif. Por arriba y los lados
// deja aire de sobra, para que las sombras de texto no salgan cortadas.
const MASCARA = 'inset(-1em -1em -0.25em)'

const ETIQUETAS = { div: m.div, li: m.li } as const

interface RevelaProps {
  children: React.ReactNode
  /** Posición en la cascada de su sección: cada paso retrasa la entrada 120 ms. */
  orden?: number
  retraso?: number
  as?: keyof typeof ETIQUETAS
  efecto?: Efecto
  /**
   * Entra nada más montarse, sin esperar a estar a la vista. Para lo que está
   * arriba del todo (el hero): así la coreografía arranca con la página y no
   * depende del observador.
   */
  alMontar?: boolean
  sx?: SxProps<Theme>
  className?: string
  id?: string
}

/**
 * Elemento que aparece al entrar en pantalla. Se dispara por su cuenta (no
 * depende de la sección), así que también entra bien si se monta tarde, por
 * ejemplo cuando las noticias llegan de la API con la sección ya a la vista.
 */
export function Revela({ children, orden = 0, retraso = 0, as = 'div', efecto = 'subir', alMontar = false, sx, className, id }: RevelaProps) {
  const reduceMotion = useReducedMotion()
  // En la vista en vivo del constructor, quieta: la página se vuelve a pintar
  // con cada tecla, y la entrada se quedaba a medias, con el bloque apagado.
  const enConstructor = useModoEdicion() !== null

  // Con prefers-reduced-motion activo, visible desde el principio: nunca queda en opacity:0.
  if (reduceMotion || enConstructor) {
    return <Box component={as} sx={sx} className={className} id={id}>{children}</Box>
  }

  const { oculto, visible, duracion } = EFECTOS[efecto]
  const transition = { duration: duracion, delay: retraso + orden * PASO, ease: CURVA_ENTRADA }
  const disparo = alMontar ? { animate: visible } : { whileInView: visible, viewport: VIEWPORT }

  // La cortina necesita dos capas: la máscara, quieta, y el texto que sube dentro.
  // Quien vigila si está a la vista es la máscara, y le pasa la variante al texto:
  // el texto empieza recortado del todo por la máscara, y Chrome descuenta el
  // clip-path al medir la intersección, así que nunca lo daría por visible.
  if (efecto === 'cortina') {
    const disparoMascara = alMontar ? { animate: 'visible' } : { whileInView: 'visible', viewport: VIEWPORT }
    return (
      <Box component={ETIQUETAS[as]} initial="oculto" {...disparoMascara} sx={[{ clipPath: MASCARA }, ...(Array.isArray(sx) ? sx : [sx])]} className={className} id={id}>
        <m.div variants={{ oculto, visible }} transition={transition}>{children}</m.div>
      </Box>
    )
  }

  return (
    <Box component={ETIQUETAS[as]} initial={oculto} {...disparo} transition={transition} sx={sx} className={className} id={id}>
      {children}
    </Box>
  )
}

// Este componente SIEMPRE renderiza un <section> quieto: el fondo nunca se mueve,
// porque entre bloques oscuros seguidos se vería el corte. Lo que entra es el contenido.
interface SeccionAnimadaProps {
  children: React.ReactNode
  delay?: number
  /** El contenido ya lleva sus propios <Revela>: no se envuelve en uno común. */
  cascada?: boolean
  sx?: SxProps<Theme>
  id?: string
  className?: string
  'aria-labelledby'?: string
}

export default function SeccionAnimada({ children, delay = 0, cascada = false, sx, ...props }: SeccionAnimadaProps) {
  return (
    <Box component="section" sx={sx} {...props}>
      {cascada ? children : <Revela retraso={delay}>{children}</Revela>}
    </Box>
  )
}
