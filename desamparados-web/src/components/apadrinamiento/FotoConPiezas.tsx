import type { MouseEvent } from 'react'
import { Box, ButtonBase, Tooltip } from '@mui/material'
import type { Pieza } from '../../lib/api/apadrinamientos'
import { euros } from '../../lib/euros'
import { MARCA, alfa } from '../../theme/marca'

interface Props {
  foto: string
  titulo: string
  piezas: Pieza[]
  /** La pieza marcada (la que se está apadrinando o editando). */
  elegida?: number | null
  /** Al pulsar una pieza. Sin él, las piezas no se pulsan. */
  onElegir?: (pieza: Pieza) => void
  /** Al pulsar la foto fuera de una pieza, con la posición en porcentaje (el editor del CMS). */
  onPulsarFoto?: (x: number, y: number) => void
  /** En la web pública, las apadrinadas no se eligen; en el CMS, sí (para editarlas). */
  apadrinadasElegibles?: boolean
}


/**
 * La foto de una campaña con sus piezas encima, en porcentaje: se colocan
 * igual en cualquier tamaño de pantalla. Cada pieza es un botón con su nombre,
 * su precio y si ya está apadrinada, para lector de pantalla y para el dedo.
 */
export default function FotoConPiezas({ foto, titulo, piezas, elegida = null, onElegir, onPulsarFoto, apadrinadasElegibles = false }: Props) {
  const pulsarFoto = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPulsarFoto || e.target !== e.currentTarget.querySelector('img')) return
    const caja = e.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - caja.left) / caja.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - caja.top) / caja.height) * 100))
    onPulsarFoto(Math.round(x * 100) / 100, Math.round(y * 100) / 100)
  }

  return (
    <Box onClick={pulsarFoto} sx={{ position: 'relative', lineHeight: 0, cursor: onPulsarFoto ? 'crosshair' : 'default', borderRadius: 1, overflow: 'hidden' }}>
      <Box component="img" src={foto} alt={titulo} sx={{ width: '100%', height: 'auto', display: 'block' }} />
      {piezas.map((p) => {
        const texto = p.apadrinada
          ? `${p.nombre}: apadrinada${p.padrino ? ` por ${p.padrino}` : ''}`
          : `${p.nombre}: libre, ${euros(p.precio)}`
        const pulsable = Boolean(onElegir) && (!p.apadrinada || apadrinadasElegibles)
        return (
          // El span va entre el Tooltip y el botón: un botón deshabilitado no
          // recibe eventos, y sin él la pieza apadrinada no diría por quién.
          <Tooltip key={p.id} title={texto} arrow>
            <Box component="span" sx={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)', lineHeight: 0 }}>
            <ButtonBase
              aria-label={texto}
              aria-pressed={elegida === p.id}
              disabled={!pulsable}
              onClick={(e) => { e.stopPropagation(); onElegir?.(p) }}
              sx={{
                width: 30, height: 30, borderRadius: '50%', fontSize: 16, fontWeight: 700, lineHeight: 1,
                border: '2px solid', borderColor: MARCA.acentoPieza,
                bgcolor: p.apadrinada ? MARCA.principalPieza : 'rgba(20, 17, 17, 0.72)', color: p.apadrinada ? '#f3ebdc' : MARCA.acentoPieza,
                boxShadow: elegida === p.id ? `0 0 0 4px ${alfa(MARCA.acentoPieza, 0.6)}` : '0 1px 4px rgba(0,0,0,0.5)',
                '&.Mui-disabled': { color: p.apadrinada ? '#f3ebdc' : MARCA.acentoPieza },
                '&:hover': pulsable ? { transform: 'scale(1.12)' } : undefined,
                transition: 'transform .15s',
              }}
            >
              {p.apadrinada ? '✓' : '+'}
            </ButtonBase>
            </Box>
          </Tooltip>
        )
      })}
    </Box>
  )
}
