import { useRef, useState, type PointerEvent } from 'react'
import { Box, Button, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { useReducedMotion } from 'framer-motion'
import type { MedioGaleria } from '../../lib/api/contenido'
import { imagenDe } from './formato'
import { ESMALTE } from '../esmalte'

/** Los botones del pie de las estampas: esmalte oscuro, algo más bajos. */
const BOTON_ESTAMPA = { ...ESMALTE.oscuro, minHeight: 40, px: 2, fontSize: 14 } as const

/** El giro de cada estampa del pila, siempre el mismo para la misma foto. */
const GIROS = [-2, 4, -5, 3, -3, 6, -4, 2]
/** Lo que hay que arrastrar la de arriba para mandarla al fondo. */
const UMBRAL = 80
/** Por debajo de esto no es arrastrar, es pulsar: se amplía. */
const PULSACION = 6
/** Las que se pintan del pila: las de más abajo no se ven. */
const VISIBLES = 5

/**
 * Un pila de estampas, como las que se reparten en un besamanos: fotos con
 * su marco de papel, un poco giradas, una encima de otra. La de arriba se
 * arrastra a un lado (con el dedo o el ratón) y pasa al fondo; pulsarla la
 * amplía en el visor. Con los botones se pasa adelante y atrás, que es como
 * lo hace quien usa el teclado.
 */
export default function Estampas({ medios, onAbrir }: {
  medios: MedioGaleria[]
  onAbrir: (indice: number, reproducir: boolean) => void
}) {
  const quieto = useReducedMotion() ?? false
  const [orden, setOrden] = useState(() => medios.map((_, i) => i))
  const [arrastre, setArrastre] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [saliendo, setSaliendo] = useState<number | null>(null)
  const inicio = useRef<number | null>(null)

  // Si cambian los medios (en la vista previa del CMS), el pila empieza de nuevo.
  const valido = orden.length === medios.length && orden.every((i) => i < medios.length)
  const pila = valido ? orden : medios.map((_, i) => i)
  const arriba = pila[0]
  const medio = medios[arriba]

  const siguiente = (lado = 1) => {
    if (medios.length < 2) return
    setArrastre(0)
    if (quieto) { setOrden([...pila.slice(1), arriba]); return }
    setSaliendo(lado)
    window.setTimeout(() => { setSaliendo(null); setOrden((o) => [...o.slice(1), o[0]]) }, 260)
  }
  const anterior = () => {
    if (medios.length < 2) return
    setOrden([pila[pila.length - 1], ...pila.slice(0, -1)])
  }

  const baja = (e: PointerEvent<HTMLDivElement>) => {
    inicio.current = e.clientX
    setArrastrando(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const mueve = (e: PointerEvent<HTMLDivElement>) => {
    if (inicio.current !== null) setArrastre(e.clientX - inicio.current)
  }
  const sube = () => {
    if (inicio.current === null) return
    inicio.current = null
    setArrastrando(false)
    if (Math.abs(arrastre) < PULSACION) { setArrastre(0); onAbrir(arriba, medio.tipo === 'video'); return }
    if (Math.abs(arrastre) > UMBRAL) siguiente(Math.sign(arrastre))
    else setArrastre(0)
  }

  return (
    <Box sx={{ display: 'grid', justifyItems: 'center', gap: 2.5 }}>
      <Box sx={{ position: 'relative', width: '100%', maxWidth: 520, height: { xs: 440, md: 540 } }}>
        {pila.slice(0, VISIBLES).reverse().map((i) => {
          const m = medios[i]
          const esArriba = i === arriba
          const giro = esArriba ? 0 : GIROS[i % GIROS.length]
          let transform = `translate(-50%, -50%) rotate(${giro}deg)`
          if (esArriba && saliendo !== null) transform = `translate(calc(-50% + ${saliendo * 420}px), -50%) rotate(${saliendo * 18}deg)`
          else if (esArriba && arrastre) transform = `translate(calc(-50% + ${arrastre}px), -50%) rotate(${arrastre / 20}deg)`
          return (
            <Box
              key={i}
              aria-hidden={!esArriba}
              onPointerDown={esArriba ? baja : undefined}
              onPointerMove={esArriba ? mueve : undefined}
              onPointerUp={esArriba ? sube : undefined}
              onPointerCancel={esArriba ? () => { inicio.current = null; setArrastrando(false); setArrastre(0) } : undefined}
              sx={{
                position: 'absolute', left: '50%', top: '50%', width: { xs: '76%', md: 340 }, aspectRatio: '3 / 4',
                p: '10px 10px 40px', backgroundColor: '#f7f3ec', boxShadow: '0 18px 40px -12px rgba(0,0,0,.6)',
                transform, touchAction: esArriba ? 'pan-y' : undefined, userSelect: 'none',
                cursor: esArriba ? (arrastrando ? 'grabbing' : 'grab') : 'default',
                transition: arrastrando || quieto ? 'none' : 'transform .6s cubic-bezier(.2, .8, .2, 1)',
              }}
            >
              <Box component="img" src={imagenDe(m)} alt="" draggable={false} loading="lazy" decoding="async"
                sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
              {m.tipo === 'video' && (
                <Box sx={{ position: 'absolute', inset: '10px 10px 40px', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                  <PlayArrowRoundedIcon sx={{ fontSize: 56, color: '#fff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.6))' }} />
                </Box>
              )}
              {m.pie && (
                <Typography component="span" sx={{
                  position: 'absolute', left: 8, right: 8, bottom: 11, textAlign: 'center', fontSize: 13, letterSpacing: '0.06em', color: '#3a3336',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {m.pie}
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button size="small" onClick={anterior} disabled={medios.length < 2} startIcon={<ArrowBackIcon />} aria-label="Estampa anterior" sx={{ ...BOTON_ESTAMPA, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Anterior</Box>
        </Button>
        <Button size="small" onClick={() => onAbrir(arriba, medio.tipo === 'video')} sx={BOTON_ESTAMPA}>
          {medio.tipo === 'video' ? 'Ver el vídeo' : 'Ampliar'}
        </Button>
        <Button size="small" onClick={() => siguiente()} disabled={medios.length < 2} endIcon={<ArrowForwardIcon />} aria-label="Estampa siguiente" sx={{ ...BOTON_ESTAMPA, '& .MuiButton-endIcon': { ml: { xs: 0, sm: 1 } } }}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Siguiente</Box>
        </Button>
      </Box>
      <Typography aria-live="polite" sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
        {`${arriba + 1} / ${medios.length}`}{medio.pie ? ` · ${medio.pie}` : ''}
        <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{` · ${medio.alt}`}</Box>
      </Typography>
    </Box>
  )
}
