/**
 * El editor del trazado de un recorrido sobre su plano: se dibuja la línea
 * pulsando sobre el plano, punto a punto en el orden en que anda la
 * procesión, y después se sitúa cada parada pulsando en su sitio.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import UndoIcon from '@mui/icons-material/Undo'
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined'
import LoopIcon from '@mui/icons-material/Loop'
import topes from '../../../../../../shared/topes-contenido.json'
import { fraccionMasCercana, posicionesEnRuta, puntoEn, puntosSvg } from '../../../../components/bloques/recorrido'
import type { ParadaRecorrido, PuntoDePlano } from '../../../../lib/api/contenido'

const ORO = '#dec72b'
const redondea = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100

interface Props {
  plano: string
  trazado: PuntoDePlano[]
  paradas: ParadaRecorrido[]
  onTrazado: (trazado: PuntoDePlano[]) => void
  onParadas: (paradas: ParadaRecorrido[]) => void
}

type Modo = 'dibujar' | 'situar'

export default function EditorDeTrazado({ plano, trazado, paradas, onTrazado, onParadas }: Props) {
  const [modo, setModo] = useState<Modo>(trazado.length >= 2 ? 'situar' : 'dibujar')
  const [aspecto, setAspecto] = useState<number | null>(null)
  const [parada, setParada] = useState(0)
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const lienzo = useRef<HTMLDivElement>(null)
  const foto = useRef<HTMLImageElement>(null)

  const mideFoto = useCallback(() => {
    const img = foto.current
    if (img && img.complete && img.naturalHeight > 0) setAspecto(img.naturalWidth / img.naturalHeight)
  }, [])
  useEffect(mideFoto, [mideFoto, plano])

  /** El punto pulsado, en tanto por ciento del plano. */
  const puntoDe = (e: PointerEvent): PuntoDePlano | null => {
    const caja = lienzo.current?.getBoundingClientRect()
    if (!caja || caja.width === 0) return null
    return { x: redondea(((e.clientX - caja.left) / caja.width) * 100), y: redondea(((e.clientY - caja.top) / caja.height) * 100) }
  }

  const pulsa = (e: PointerEvent) => {
    if (arrastrando !== null) return
    const p = puntoDe(e)
    if (!p) return
    if (modo === 'dibujar') {
      if (trazado.length >= topes.puntosPorTrazado) return
      onTrazado([...trazado, p])
      return
    }
    // Situar sí necesita la proporción del plano, para medir el recorrido.
    if (aspecto === null || trazado.length < 2 || paradas.length === 0) return
    const enRuta = Math.round(fraccionMasCercana(trazado, aspecto, p) * 10000) / 10000
    onParadas(paradas.map((q, i) => (i === parada ? { ...q, enRuta } : q)))
    // A la siguiente: las paradas se sitúan casi siempre seguidas.
    setParada((actual) => Math.min(paradas.length - 1, actual + 1))
  }

  const mueve = (e: PointerEvent) => {
    if (arrastrando === null) return
    const p = puntoDe(e)
    if (p) onTrazado(trazado.map((q, i) => (i === arrastrando ? p : q)))
  }

  const posiciones = posicionesEnRuta(paradas)
  const situadas = paradas.filter((p) => typeof p.enRuta === 'number').length

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        exclusive size="small" value={modo}
        onChange={(_, valor: Modo | null) => valor && setModo(valor)}
        aria-label="Qué se hace al pulsar en el plano"
      >
        <ToggleButton value="dibujar">Dibujar el recorrido</ToggleButton>
        <ToggleButton value="situar" disabled={trazado.length < 2}>Situar las paradas</ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="body2" color="text.secondary">
        {modo === 'dibujar'
          ? 'Pulsa sobre el plano en cada esquina del recorrido, en el orden en que anda la procesión: de la salida a la entrada. Arrastra un punto para corregirlo.'
          : 'Elige la parada y pulsa en su sitio del recorrido: se engancha a la línea. Las que no sitúes se reparten solas entre las demás.'}
      </Typography>

      {modo === 'situar' && (
        <TextField
          select size="small" label="Parada que sitúas" value={parada}
          onChange={(e) => setParada(Number(e.target.value))}
          slotProps={{ select: { native: true } }}
          sx={{ maxWidth: 420 }}
        >
          {paradas.map((p, i) => (
            <option key={i} value={i}>
              {`${p.hora} · ${p.lugar || 'sin lugar'}${typeof p.enRuta === 'number' ? ' (situada)' : ''}`}
            </option>
          ))}
        </TextField>
      )}

      <Box
        ref={lienzo}
        onPointerDown={pulsa}
        onPointerMove={mueve}
        onPointerUp={() => setArrastrando(null)}
        onPointerLeave={() => setArrastrando(null)}
        sx={{ position: 'relative', cursor: 'crosshair', userSelect: 'none', touchAction: 'none', border: 1, borderColor: 'divider', lineHeight: 0 }}
      >
        <Box component="img" ref={foto} src={plano} alt="" onLoad={mideFoto} draggable={false}
          sx={{ display: 'block', width: '100%', height: 'auto', filter: 'brightness(.6) saturate(.7)', pointerEvents: 'none' }} />
        {aspecto !== null && (
          <Box component="svg" viewBox={`0 0 ${100 * aspecto} 100`} aria-hidden="true"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {trazado.length >= 2 && (
              <polyline points={puntosSvg(trazado, aspecto)} fill="none" stroke={ORO} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </Box>
        )}
        {modo === 'dibujar' && trazado.map((p, i) => (
          <Box
            key={i}
            onPointerDown={(e) => { e.stopPropagation(); setArrastrando(i) }}
            title={`Punto ${i + 1}`}
            sx={{
              position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)',
              width: i === trazado.length - 1 ? 14 : 10, height: i === trazado.length - 1 ? 14 : 10, borderRadius: '50%',
              backgroundColor: i === 0 ? '#fc858a' : ORO, border: '2px solid #100e11', cursor: 'grab',
            }}
          />
        ))}
        {modo === 'situar' && aspecto !== null && trazado.length >= 2 && posiciones.map((f, i) => {
          const p = puntoEn(trazado, aspecto, f)
          const fija = typeof paradas[i].enRuta === 'number'
          return (
            <Box key={i} sx={{
              position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)',
              minWidth: 20, height: 20, px: 0.5, borderRadius: 10, display: 'grid', placeItems: 'center',
              fontSize: 11, fontWeight: 700, lineHeight: 1, pointerEvents: 'none',
              backgroundColor: i === parada ? '#fc858a' : fija ? ORO : 'rgba(255,255,255,.75)', color: '#100e11',
              outline: i === parada ? '2px solid #fff' : 'none',
            }}>
              {i + 1}
            </Box>
          )
        })}
      </Box>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {modo === 'dibujar' ? (
          <>
            <Button size="small" startIcon={<UndoIcon />} disabled={trazado.length === 0} onClick={() => onTrazado(trazado.slice(0, -1))}>
              Quitar el último punto
            </Button>
            <Button size="small" startIcon={<LoopIcon />} disabled={trazado.length < 3}
              onClick={() => onTrazado([...trazado, trazado[0]])}>
              Volver a la salida
            </Button>
            <Button size="small" color="error" startIcon={<DeleteSweepOutlinedIcon />} disabled={trazado.length === 0} onClick={() => onTrazado([])}>
              Borrar el recorrido
            </Button>
          </>
        ) : (
          <Button size="small" disabled={situadas === 0}
            onClick={() => onParadas(paradas.map(({ enRuta: _quitada, ...resto }) => resto))}>
            Repartir todas solas
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {modo === 'dibujar'
            ? `${trazado.length} ${trazado.length === 1 ? 'punto' : 'puntos'}${trazado.length === 1 ? ': hace falta otro para que haya línea' : ''}`
            : `${situadas} de ${paradas.length} paradas situadas a mano`}
        </Typography>
      </Stack>
    </Stack>
  )
}
