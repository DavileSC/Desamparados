import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent, type TouchEvent } from 'react'
import { Box, ButtonBase, Dialog, IconButton, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation'
import type { MedioGaleria } from '../../lib/api/contenido'
import { DORADO, botonRedondo, fondoDesenfocado, imagenDe, type Medida } from './formato'

const entra = keyframes`from { opacity: 0; transform: scale(0.98) } to { opacity: 1; transform: none }`

interface Props {
  medios: MedioGaleria[]
  /** El medio abierto, o `null` con el visor cerrado. */
  actual: number | null
  onIr: (indice: number) => void
  onCerrar: () => void
  /** Vídeos a los que ya se ha dado al play: solo esos cargan el marco de YouTube. */
  reproduciendo: string[]
  onReproducir: (url: string) => void
  medidaDe: (medio: MedioGaleria) => Medida
  medir: (evento: SyntheticEvent<HTMLImageElement>) => void
  escritorio: boolean
}

const dos = (n: number) => String(n).padStart(2, '0')

/** Lo que hay que bajar el dedo para cerrar el visor en el móvil. */
const BAJAR_PARA_CERRAR = 90

/**
 * Un medio a pantalla completa, ajustado sin recortarlo: una horizontal toma
 * el ancho y una vertical el alto; lo que sobra se rellena con su propio color
 * desenfocado. Un vídeo se reproduce en su proporción (la de su portada), así
 * que uno grabado en vertical se ve en vertical.
 */
function Medio({ medio, activo, reproduciendo, onReproducir, medidaDe, medir }: {
  medio: MedioGaleria
  activo: boolean
  reproduciendo: boolean
  onReproducir: () => void
  medidaDe: (medio: MedioGaleria) => Medida
  medir: (evento: SyntheticEvent<HTMLImageElement>) => void
}) {
  const { proporcion } = medidaDe(medio)
  if (medio.tipo === 'video' && reproduciendo && activo) {
    return (
      // El mayor marco que cabe con su proporción: el hueco declara su tamaño
      // (container-type: size) y el ancho sale de él, sin deformar el vídeo.
      <Box sx={{ position: 'relative', aspectRatio: String(proporcion), width: `min(100cqw, calc(100cqh * ${proporcion}))`, animation: `${entra} 240ms ease-out` }}>
        <Box
          component="iframe"
          src={`${medio.url}${medio.url.includes('?') ? '&' : '?'}autoplay=1`}
          title={medio.alt}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sx={{ width: '100%', height: '100%', border: 0, display: 'block', borderRadius: 1, bgcolor: '#000' }}
        />
      </Box>
    )
  }
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: activo ? `${entra} 240ms ease-out` : 'none' }}>
      <Box
        component="img"
        src={imagenDe(medio)}
        alt={medio.alt}
        data-medida={imagenDe(medio)}
        onLoad={medir}
        sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', borderRadius: 1, boxShadow: '0 30px 90px rgba(0,0,0,0.6)', userSelect: 'none' }}
      />
      {medio.tipo === 'video' && (
        <IconButton
          onClick={onReproducir}
          aria-label={`Reproducir: ${medio.alt}`}
          sx={{ position: 'absolute', inset: 0, m: 'auto', width: 88, height: 88, border: `2px solid ${DORADO}`, color: DORADO, bgcolor: 'rgba(7,6,8,0.55)', '&:hover': { bgcolor: 'rgba(7,6,8,0.75)' } }}
        >
          <PlayArrowIcon sx={{ fontSize: 42 }} />
        </IconButton>
      )}
    </Box>
  )
}

export default function VisorGaleria({ medios, actual, onIr, onCerrar, reproduciendo, onReproducir, medidaDe, medir, escritorio }: Props) {
  const abierto = actual !== null
  const indice = actual ?? 0
  const medio = medios[indice]
  const varios = medios.length > 1

  const teclas = (evento: KeyboardEvent) => {
    if (!varios) return
    if (evento.key === 'ArrowLeft') { evento.preventDefault(); onIr(indice - 1) }
    if (evento.key === 'ArrowRight') { evento.preventDefault(); onIr(indice + 1) }
  }

  return (
    <Dialog
      open={abierto}
      onClose={onCerrar}
      fullScreen
      onKeyDown={teclas}
      slotProps={{ paper: { 'aria-label': 'Galería ampliada', sx: { bgcolor: '#0a080b', backgroundImage: 'none', color: 'common.white' } } }}
    >
      {abierto && medio && (escritorio
        ? <VisorEscritorio {...{ medios, indice, medio, varios, onIr, onCerrar, reproduciendo, onReproducir, medidaDe, medir }} />
        : <VisorMovil {...{ medios, indice, medio, varios, onIr, onCerrar, reproduciendo, onReproducir, medidaDe, medir }} />)}
    </Dialog>
  )
}

type PropsVista = Omit<Props, 'actual' | 'escritorio'> & { indice: number; medio: MedioGaleria; varios: boolean }

function VisorEscritorio({ medios, indice, medio, varios, onIr, onCerrar, reproduciendo, onReproducir, medidaDe, medir }: PropsVista) {
  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      <Box sx={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Box component="img" src={imagenDe(medio)} alt="" aria-hidden="true" sx={fondoDesenfocado(70, 0.32)} />
        <Box sx={{ position: 'absolute', top: 48, bottom: 88, left: 96, right: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
          <Medio key={indice} medio={medio} activo reproduciendo={reproduciendo.includes(medio.url)} onReproducir={() => onReproducir(medio.url)} medidaDe={medidaDe} medir={medir} />
        </Box>
        {varios && (
          <>
            <IconButton aria-label="Anterior" onClick={() => onIr(indice - 1)} sx={{ ...botonRedondo(56), position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)' }}><ChevronLeftIcon /></IconButton>
            <IconButton aria-label="Siguiente" onClick={() => onIr(indice + 1)} sx={{ ...botonRedondo(56), position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)' }}><ChevronRightIcon /></IconButton>
          </>
        )}
        <Box aria-hidden="true" sx={{ position: 'absolute', left: 0, right: 0, bottom: 28, display: 'flex', justifyContent: 'center', gap: 2.5, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
          {varios && <span><b style={{ color: 'rgba(255,255,255,0.8)' }}>← →</b> para pasar</span>}
          <span><b style={{ color: 'rgba(255,255,255,0.8)' }}>Esc</b> para cerrar</span>
        </Box>
      </Box>
      <Box component="aside" sx={{ width: 320, flexShrink: 0, boxSizing: 'border-box', p: 3.5, bgcolor: 'rgba(7,6,8,0.85)', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>
            <Box component="b" sx={{ color: 'common.white', fontWeight: 600 }}>{dos(indice + 1)}</Box> / {dos(medios.length)}
          </Typography>
          <IconButton aria-label="Cerrar" onClick={onCerrar} sx={{ ...botonRedondo(44), bgcolor: 'transparent' }}><CloseIcon /></IconButton>
        </Box>
        {medio.pie && <Typography sx={{ fontSize: 20, lineHeight: 1.35, fontWeight: 500 }}>{medio.pie}</Typography>}
        <Typography sx={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>{medio.alt}</Typography>
        {varios && (
          <Box sx={{ mt: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, maxHeight: '45vh', overflowY: 'auto', p: 0.5 }}>
            {medios.map((m, i) => (
              <ButtonBase
                key={`${imagenDe(m)}-${i}`}
                onClick={() => onIr(i)}
                aria-label={`Ver: ${m.alt}`}
                aria-current={i === indice ? 'true' : undefined}
                sx={{ position: 'relative', height: 72, borderRadius: 1, overflow: 'hidden', opacity: i === indice ? 1 : 0.5, outline: i === indice ? `2px solid ${DORADO}` : 'none', outlineOffset: 2, '&:hover': { opacity: 1 } }}
              >
                <Box component="img" src={imagenDe(m)} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {m.tipo === 'video' && <PlayArrowIcon aria-hidden="true" sx={{ position: 'absolute', right: 4, bottom: 4, fontSize: 18, color: DORADO }} />}
              </ButtonBase>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

function VisorMovil({ medios, indice, medio, varios, onIr, onCerrar, reproduciendo, onReproducir, medidaDe, medir }: PropsVista) {
  const carril = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const [bajando, setBajando] = useState(0)
  const [vertical, setVertical] = useState(() => window.matchMedia?.('(orientation: portrait)').matches ?? true)

  useEffect(() => {
    const consulta = window.matchMedia?.('(orientation: portrait)')
    if (!consulta?.addEventListener) return
    const cambio = () => setVertical(consulta.matches)
    consulta.addEventListener('change', cambio)
    return () => consulta.removeEventListener('change', cambio)
  }, [])

  // Empieza en el medio que se tocó, y sigue a `indice` si cambia desde fuera.
  useEffect(() => {
    const el = carril.current
    if (!el || !el.clientWidth) return
    const destino = indice * el.clientWidth
    if (Math.abs(el.scrollLeft - destino) > 4) el.scrollTo({ left: destino })
  }, [indice])

  const alDeslizar = () => {
    const el = carril.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== indice && i >= 0 && i < medios.length) onIr(i)
  }

  // Bajar el dedo cierra, como en las galerías del propio móvil.
  const tocar = (e: TouchEvent) => { inicio.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const mover = (e: TouchEvent) => {
    if (!inicio.current) return
    const dy = e.touches[0].clientY - inicio.current.y
    const dx = Math.abs(e.touches[0].clientX - inicio.current.x)
    setBajando(dy > 0 && dy > dx ? dy : 0)
  }
  const soltar = () => {
    if (bajando > BAJAR_PARA_CERRAR) onCerrar()
    inicio.current = null
    setBajando(0)
  }

  const girar = vertical && medidaDe(medio).formato === 'h'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', opacity: 1 - Math.min(bajando / 400, 0.5) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: 2.5, pr: 1.5, py: 1.25 }}>
        <Typography sx={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
          <b>{dos(indice + 1)}</b> <Box component="span" sx={{ color: 'rgba(255,255,255,0.55)' }}>/ {dos(medios.length)}</Box>
        </Typography>
        <IconButton aria-label="Cerrar" onClick={onCerrar} sx={{ width: 44, height: 44, color: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' }}><CloseIcon /></IconButton>
      </Box>
      <Box
        ref={carril}
        onScroll={alDeslizar}
        onTouchStart={tocar}
        onTouchMove={mover}
        onTouchEnd={soltar}
        sx={{ flex: 1, minHeight: 0, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, transform: `translateY(${bajando}px)` }}
      >
        {medios.map((m, i) => (
          <Box key={`${imagenDe(m)}-${i}`} sx={{ position: 'relative', flex: '0 0 100%', height: '100%', scrollSnapAlign: 'start', overflow: 'hidden' }}>
            <Box component="img" src={imagenDe(m)} alt="" aria-hidden="true" loading="lazy" sx={fondoDesenfocado(40, 0.3)} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
            <Medio medio={m} activo={i === indice} reproduciendo={reproduciendo.includes(m.url)} onReproducir={() => onReproducir(m.url)} medidaDe={medidaDe} medir={medir} />
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ px: 2.5, pt: 1.75, pb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {girar && (
          <Typography sx={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
            <ScreenRotationIcon sx={{ fontSize: 16 }} />Gira el móvil para verla más grande
          </Typography>
        )}
        {medio.pie && <Typography sx={{ fontSize: 16, fontWeight: 500 }}>{medio.pie}</Typography>}
        <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>{varios ? 'Desliza para pasar · baja para cerrar' : 'Baja para cerrar'}</Typography>
      </Box>
    </Box>
  )
}
