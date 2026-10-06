import { useId, useState, type MouseEvent } from 'react'
import { Box, Slider, Typography } from '@mui/material'
import { ENCUADRE_MOVIL_POR_DEFECTO } from '../../../lib/api/portada'

/**
 * La proporción de la cabecera en un móvil corriente (390 × 780 bajo la barra).
 * En la tableta es más ancha, así que lo que se ve aquí es lo más justo.
 */
const PROPORCION_MOVIL = 390 / 780

/**
 * Qué parte de una foto de la cabecera se ve en el móvil. La foto es apaisada y
 * la cabecera del móvil, vertical: se recorta por los lados, y sin elegir, la
 * cara de una imagen puede quedarse fuera. Se enseña la foto entera con la
 * franja que queda a la vista, y se mueve pulsando en la foto o con el
 * deslizador, que es el control de verdad (la foto pulsable es un atajo para
 * el ratón y no lo ve el lector de pantalla).
 */
export default function EncuadreEnElMovil({ url, valor, onCambio }: { url: string; valor?: number; onCambio: (encuadre: number) => void }) {
  const id = useId()
  const [proporcion, setProporcion] = useState<number | null>(null)
  const x = valor ?? ENCUADRE_MOVIL_POR_DEFECTO
  // La franja, en fracción del ancho de la foto. Si la foto ya es más estrecha
  // que el móvil, se ve entera a lo ancho y no hay nada que elegir.
  const franja = proporcion ? Math.min(1, PROPORCION_MOVIL / proporcion) : null
  const izquierda = franja === null ? 0 : (1 - franja) * (x / 100)

  const alPulsar = (e: MouseEvent<HTMLElement>) => {
    if (franja === null || franja >= 1) return
    const caja = e.currentTarget.getBoundingClientRect()
    const centro = (e.clientX - caja.left) / caja.width
    const nuevo = ((centro - franja / 2) / (1 - franja)) * 100
    onCambio(Math.round(Math.min(100, Math.max(0, nuevo)) / 5) * 5)
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography id={id} variant="body2" gutterBottom>Encuadre en el móvil</Typography>
      <Box onClick={alPulsar} aria-hidden="true" sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', cursor: franja !== null && franja < 1 ? 'pointer' : 'default', maxWidth: 520, lineHeight: 0 }}>
        <Box component="img" src={url} alt="" onLoad={(e) => { const i = e.currentTarget; if (i.naturalHeight) setProporcion(i.naturalWidth / i.naturalHeight) }}
          sx={{ display: 'block', width: '100%', height: 'auto' }} />
        {franja !== null && franja < 1 && <>
          {/* Lo que se queda fuera, velado; la franja, con su marco. */}
          <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${izquierda * 100}%`, bgcolor: 'rgba(0,0,0,.6)', transition: 'width .2s' }} />
          <Box sx={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${(1 - izquierda - franja) * 100}%`, bgcolor: 'rgba(0,0,0,.6)', transition: 'width .2s' }} />
          <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${izquierda * 100}%`, width: `${franja * 100}%`, border: '2px solid #fff', borderRadius: 1, boxShadow: '0 0 0 1px rgba(0,0,0,.4)', transition: 'left .2s' }} />
        </>}
      </Box>
      <Box sx={{ px: 3, maxWidth: 520 }}>
        <Slider aria-labelledby={id} value={x} onChange={(_, v) => onCambio(v as number)} min={0} max={100} step={5}
          marks={[{ value: 0, label: 'Izquierda' }, { value: 50, label: 'Centro' }, { value: 100, label: 'Derecha' }]}
          getAriaValueText={(v) => `${v} %`} disabled={franja !== null && franja >= 1} />
      </Box>
      <Typography variant="caption" component="p" color="text.secondary">
        {franja !== null && franja >= 1
          ? 'Esta foto es estrecha: en el móvil se ve entera a lo ancho.'
          : 'En el móvil la cabecera es vertical y se ve solo la franja marcada. Muévela para que quede a la vista la cara o lo importante; pulsar en la foto también la mueve.'}
      </Typography>
    </Box>
  )
}
