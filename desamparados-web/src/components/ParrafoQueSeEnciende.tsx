import { useRef, type CSSProperties } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { useModoEdicion } from './bloques/modoEdicion'

/** Palabras que ocupa el borde entre lo encendido y lo apagado: un borde suave, no un corte. */
const BORDE = 3
/** Gris cálido de las palabras aún apagadas, y blanco de las encendidas. */
const APAGADA = '#968f93'
const ENCENDIDA = '#ffffff'

/** Fuera de la vista, pero presente para lectores de pantalla y búsquedas. */
const OCULTO: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }

interface Props {
  texto: string
  className?: string
  style?: CSSProperties
}

/**
 * Un párrafo que se va encendiendo palabra a palabra según se baja, y que se
 * apaga otra vez si se sube: sigue al scroll. Empieza cuando el párrafo asoma
 * por abajo y termina cuando su centro llega un poco por debajo del centro de
 * la pantalla, así que centrado ya se lee entero encendido.
 *
 * El texto de verdad va una sola vez, oculto a la vista pero no a los lectores
 * de pantalla ni a los tests; las palabras sueltas son solo lo que se pinta.
 * Con «reducir movimiento», o en la vista en vivo del constructor, sale
 * encendido desde el principio.
 */
export default function ParrafoQueSeEnciende({ texto, className, style }: Props) {
  const ref = useRef<HTMLParagraphElement>(null)
  const reducir = useReducedMotion()
  const enConstructor = useModoEdicion() !== null
  const quieto = reducir || enConstructor
  const { scrollYProgress } = useScroll({ target: ref, offset: ['center 95%', 'center 55%'] })
  // Suavizado: con la rueda del ratón el avance llega a saltos.
  const avance = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 })
  const palabras = texto.trim().split(/\s+/)

  return (
    <p ref={ref} className={className} style={style}>
      <span style={OCULTO}>{texto}</span>
      <span aria-hidden="true">
        {palabras.map((palabra, i) => (
          <span key={i}>
            {quieto ? <span style={{ color: ENCENDIDA }}>{palabra}</span> : <Palabra avance={avance} indice={i} total={palabras.length}>{palabra}</Palabra>}
            {i < palabras.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    </p>
  )
}

function Palabra({ avance, indice, total, children }: { avance: MotionValue<number>; indice: number; total: number; children: string }) {
  // El frente de luz recorre las palabras más el borde, para que la última
  // también llegue a blanco del todo justo al final del recorrido.
  const color = useTransform(avance, (p) => {
    const k = Math.min(1, Math.max(0, (p * (total + BORDE) - indice) / BORDE))
    return mezcla(k * k * (3 - 2 * k))
  })
  return <motion.span style={{ color }}>{children}</motion.span>
}

function mezcla(k: number): string {
  const a = parseInt(APAGADA.slice(1), 16)
  const b = parseInt(ENCENDIDA.slice(1), 16)
  const canal = (desplaza: number) => Math.round(((a >> desplaza) & 255) + (((b >> desplaza) & 255) - ((a >> desplaza) & 255)) * k)
  return `rgb(${canal(16)}, ${canal(8)}, ${canal(0)})`
}
