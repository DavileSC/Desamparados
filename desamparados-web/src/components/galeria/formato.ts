import { useCallback, useEffect, useState, type SyntheticEvent } from 'react'
import { keyframes } from '@mui/material/styles'
import type { MedioGaleria } from '../../lib/api/contenido'

/** Horizontal, vertical o casi cuadrada: decide cómo se encaja cada foto. */
export type Formato = 'h' | 'v' | 'c'

/** Lo que se sabe de una imagen al cargarla: su formato y su proporción (ancho / alto). */
export interface Medida { formato: Formato; proporcion: number }

export function formatoDe(ancho: number, alto: number): Medida {
  const proporcion = alto > 0 ? ancho / alto : 16 / 9
  return { proporcion, formato: proporcion > 1.15 ? 'h' : proporcion < 0.87 ? 'v' : 'c' }
}

/** La imagen que representa al medio: la foto, o la portada del vídeo. */
export const imagenDe = (medio: MedioGaleria) => (medio.tipo === 'video' ? medio.portada : medio.url)

/**
 * El formato de cada imagen, aprendido al cargarla (no se pide en el CMS: nadie
 * sabe si su foto es 3:2 o 4:5, y el navegador sí). Hasta que carga se trata
 * como horizontal, que es lo más común; al saberse, se reencaja.
 *
 * De la portada de un vídeo sale también la proporción de su marco: un vídeo
 * grabado en vertical lleva una portada vertical, y se reproduce en vertical.
 */
export function useMedidas() {
  const [medidas, setMedidas] = useState<Record<string, Medida>>({})
  const medir = useCallback((evento: SyntheticEvent<HTMLImageElement>) => {
    const img = evento.currentTarget
    const clave = img.dataset.medida
    if (!clave || !img.naturalWidth) return
    setMedidas((actuales) => (actuales[clave] ? actuales : { ...actuales, [clave]: formatoDe(img.naturalWidth, img.naturalHeight) }))
  }, [])
  const medidaDe = useCallback((medio: MedioGaleria): Medida => medidas[imagenDe(medio)] ?? { formato: 'h', proporcion: 16 / 9 }, [medidas])
  return { medir, medidaDe }
}

/** El fondo de cada medio: su propia imagen, desenfocada y oscurecida, para que una vertical no deje franjas negras. */
export const fondoDesenfocado = (desenfoque: number, brillo: number) => ({
  position: 'absolute', inset: -desenfoque * 1.5, width: `calc(100% + ${desenfoque * 3}px)`, height: `calc(100% + ${desenfoque * 3}px)`,
  objectFit: 'cover', filter: `blur(${desenfoque}px) brightness(${brillo}) saturate(1.2)`, pointerEvents: 'none',
}) as const

/** Botón redondo translúcido de las flechas y el cierre. */
export const botonRedondo = (tamano: number) => ({
  width: tamano, height: tamano, color: 'common.white', border: '1px solid rgba(255,255,255,0.28)',
  backgroundColor: 'rgba(7,6,8,0.5)', backdropFilter: 'blur(6px)',
  '&:hover': { backgroundColor: 'rgba(7,6,8,0.75)' },
  '&.Mui-focusVisible': { outline: '2px solid #dec72b', outlineOffset: 2 },
}) as const

export const DORADO = '#dec72b'

/** Lo que tarda en pasar de foto en escritorio (el «enfoque»). */
export const PASO = 1300

/*
 * El paso de foto en escritorio: la nueva llega desenfocada y en penumbra y se
 * aclara, como una vela que prende, mientras la anterior se apaga debajo. Sin
 * negro entre las dos. La escala acaba en `scale(1)` escrito: hasta `none`,
 * algunos navegadores la interpolan desde cero.
 */
const enfoqueEntra = keyframes`
  0% { opacity: 0; filter: blur(22px) brightness(0.3); transform: scale(1.05) }
  45% { opacity: 1 }
  100% { opacity: 1; filter: blur(0px) brightness(1); transform: scale(1) }
`
const enfoqueSale = keyframes`to { filter: blur(6px) brightness(0.2) }`
const funde = keyframes`from { opacity: 0 } to { opacity: 1 }`

/** La capa que entra (sin animación en la primera foto). Con «reducir movimiento», un fundido corto. */
export const animacionDeEntrada = (pasando: boolean) => ({
  animation: pasando ? `${enfoqueEntra} ${PASO}ms cubic-bezier(.3,0,.2,1) both` : 'none',
  '@media (prefers-reduced-motion: reduce)': { animation: pasando ? `${funde} 300ms ease both` : 'none' },
}) as const

export const animacionDeSalida = {
  animation: `${enfoqueSale} ${PASO}ms ease-in both`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
} as const

/**
 * El medio que se está yendo mientras entra `actual`, durante lo que dura el
 * paso; `null` el resto del tiempo. Se queda debajo de la nueva para que el
 * cambio sea entre dos fotos, no desde negro.
 */
export function useSaliente(actual: number) {
  const [previa, setPrevia] = useState(actual)
  const [saliente, setSaliente] = useState<number | null>(null)
  // En el propio render, no en un efecto: así la nueva ya monta con su animación.
  if (previa !== actual) {
    setPrevia(actual)
    setSaliente(previa)
  }
  useEffect(() => {
    if (saliente === null) return
    const reloj = window.setTimeout(() => setSaliente(null), PASO)
    return () => window.clearTimeout(reloj)
  }, [saliente, actual])
  return saliente
}
