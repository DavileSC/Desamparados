import { useRef, type PointerEvent } from 'react'
import { Box, Button, Slider, Stack, Typography } from '@mui/material'
import type { Encuadre } from '../../types'
import { ENCUADRE_CENTRADO, posicionDe } from '../../lib/encuadre'

/** Los dos recortes que hace la web de la foto de una noticia, para verlos aquí. */
const RECORTES = [
  { nombre: 'Principal', proporcion: '1200 / 560', ancho: '100%' },
  { nombre: 'Lista', proporcion: '1', ancho: 84 },
] as const

const limitar = (valor: number) => Math.round(Math.min(100, Math.max(0, valor)))

/**
 * Qué parte de la foto queda a la vista cuando la web la recorta: muy apaisada
 * en la principal del archivo, cuadrada en sus filas y 4:3 en la portada. Se
 * pulsa (o se arrastra) sobre la foto el punto que no debe perderse, la cara de
 * la imagen casi siempre; con el teclado, los dos deslizadores. Debajo, los
 * dos recortes tal como saldrán.
 */
export default function EncuadreDeFoto({ foto, valor, onCambio }: {
  foto: string
  valor: Encuadre
  onCambio: (encuadre: Encuadre) => void
}) {
  const marco = useRef<HTMLDivElement>(null)

  const marcar = (e: PointerEvent<HTMLDivElement>) => {
    const caja = marco.current?.getBoundingClientRect()
    if (!caja || caja.width === 0 || caja.height === 0) return
    onCambio({ x: limitar(((e.clientX - caja.left) / caja.width) * 100), y: limitar(((e.clientY - caja.top) / caja.height) * 100) })
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Pulsa en la foto lo que debe verse siempre: la web la recorta de distintas formas.
      </Typography>
      <Box
        ref={marco}
        data-testid="marco-encuadre"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); marcar(e) }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) marcar(e) }}
        // Del tamaño exacto de la foto: con una vertical y un marco más ancho, el
        // punto pulsado no caería donde se ve.
        sx={{ position: 'relative', alignSelf: 'center', width: 'fit-content', maxWidth: '100%', lineHeight: 0, cursor: 'crosshair', touchAction: 'none', userSelect: 'none', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
      >
        <Box component="img" src={foto} alt="" draggable={false} sx={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: 260 }} />
        <Box
          aria-hidden
          sx={{
            position: 'absolute', left: `${valor.x}%`, top: `${valor.y}%`, width: 26, height: 26, transform: 'translate(-50%, -50%)',
            borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.55), inset 0 0 0 2px rgba(0, 0, 0, 0.35)', pointerEvents: 'none',
          }}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 2, alignItems: 'center' }}>
        <Typography id="encuadre-horizontal" variant="body2">Horizontal</Typography>
        <Slider size="small" aria-labelledby="encuadre-horizontal" value={valor.x} min={0} max={100} onChange={(_, x) => onCambio({ ...valor, x: x as number })} />
        <Typography id="encuadre-vertical" variant="body2">Vertical</Typography>
        <Slider size="small" aria-labelledby="encuadre-vertical" value={valor.y} min={0} max={100} onChange={(_, y) => onCambio({ ...valor, y: y as number })} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
        {RECORTES.map((recorte) => (
          <Box key={recorte.nombre} sx={{ flex: recorte.ancho === '100%' ? 1 : '0 0 auto', width: recorte.ancho, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{recorte.nombre}</Typography>
            <Box
              component="img"
              src={foto}
              alt=""
              sx={{ display: 'block', width: '100%', aspectRatio: recorte.proporcion, objectFit: 'cover', objectPosition: posicionDe(valor), borderRadius: 0.5 }}
            />
          </Box>
        ))}
      </Box>

      <Button
        size="small"
        color="inherit"
        disabled={valor.x === ENCUADRE_CENTRADO.x && valor.y === ENCUADRE_CENTRADO.y}
        onClick={() => onCambio(ENCUADRE_CENTRADO)}
        sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}
      >
        Volver al centro
      </Button>
    </Stack>
  )
}
