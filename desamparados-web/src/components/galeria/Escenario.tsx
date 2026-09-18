import { useEffect, useState, type SyntheticEvent } from 'react'
import { Box, ButtonBase, IconButton, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import type { MedioGaleria } from '../../lib/api/contenido'
import { DORADO, botonRedondo, fondoDesenfocado, imagenDe, type Medida } from './formato'

/** Lo que dura cada foto en el pase automático. */
export const DURACION_PASE = 6000

const lento = keyframes`from { transform: scale(1) } to { transform: scale(1.07) }`
const entra = keyframes`from { opacity: 0 } to { opacity: 1 }`
const avanza = keyframes`from { transform: scaleX(0) } to { transform: scaleX(1) }`

interface Props {
  medios: MedioGaleria[]
  actual: number
  onIr: (indice: number) => void
  onAbrir: (indice: number, reproducir: boolean) => void
  medidaDe: (medio: MedioGaleria) => Medida
  medir: (evento: SyntheticEvent<HTMLImageElement>) => void
  /** Con el visor abierto, o con «reducir movimiento», no pasa sola. */
  quieta: boolean
}

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * La galería en escritorio: una foto grande sobre un fondo hecho con ella
 * misma, desenfocada. Una vertical se ve entera, con su color alrededor en vez
 * de franjas negras; una horizontal llena el escenario. Pasa sola cada pocos
 * segundos, con un botón para pararla (y se para al poner el ratón encima o
 * el foco dentro, para que nadie lea con prisas).
 */
export default function Escenario({ medios, actual, onIr, onAbrir, medidaDe, medir, quieta }: Props) {
  const [pausa, setPausa] = useState(false)
  const [encima, setEncima] = useState(false)
  const varios = medios.length > 1
  const enMarcha = varios && !pausa && !encima && !quieta
  const medio = medios[actual]
  const { formato } = medidaDe(medio)
  const esVideo = medio.tipo === 'video'

  useEffect(() => {
    if (!enMarcha) return
    const reloj = window.setTimeout(() => onIr(actual + 1), DURACION_PASE)
    return () => window.clearTimeout(reloj)
  }, [enMarcha, actual, onIr])

  return (
    <Box
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      onFocusCapture={() => setEncima(true)}
      onBlurCapture={() => setEncima(false)}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16 / 9', maxHeight: '78vh', width: '100%', borderRadius: 1.5, overflow: 'hidden', bgcolor: '#100e11' }}>
        <Box component="img" key={`fondo-${actual}`} src={imagenDe(medio)} alt="" aria-hidden="true" sx={{ ...fondoDesenfocado(38, 0.45), animation: `${entra} 500ms ease-out` }} />
        <ButtonBase
          onClick={() => onAbrir(actual, esVideo)}
          aria-label={esVideo ? `Reproducir: ${medio.alt}` : `Ampliar: ${medio.alt}`}
          sx={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: esVideo ? 'pointer' : 'zoom-in', '&.Mui-focusVisible': { outline: `3px solid ${DORADO}`, outlineOffset: -3 } }}
        >
          <Box
            component="img"
            key={`foto-${actual}`}
            src={imagenDe(medio)}
            alt={medio.alt}
            data-medida={imagenDe(medio)}
            onLoad={medir}
            sx={{
              width: '100%', height: '100%', display: 'block',
              // Horizontal: llena el escenario. Vertical o cuadrada: entera, sobre su fondo.
              objectFit: formato === 'h' ? 'cover' : 'contain',
              animation: `${entra} 500ms ease-out, ${lento} 9s ease-out infinite alternate`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
        </ButtonBase>

        {esVideo && (
          <Box aria-hidden="true" sx={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 96, height: 96, borderRadius: '50%', border: `2px solid ${DORADO}`, bgcolor: 'rgba(16,14,17,0.55)', color: DORADO, display: 'grid', placeItems: 'center', pointerEvents: 'none', backdropFilter: 'blur(6px)' }}>
            <PlayArrowIcon sx={{ fontSize: 44 }} />
          </Box>
        )}

        {varios && (
          <Typography aria-hidden="true" sx={{ position: 'absolute', top: 18, right: 24, fontVariantNumeric: 'tabular-nums', fontWeight: 300, fontSize: 36, lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.5)', pointerEvents: 'none' }}>
            {dos(actual + 1)}<Box component="span" sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', ml: 1 }}>/ {dos(medios.length)}</Box>
          </Typography>
        )}

        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, px: 4, pt: 10, pb: 3, background: 'linear-gradient(to top, rgba(16,14,17,0.9), rgba(16,14,17,0))', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 3, pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 500, maxWidth: 680, textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>{medio.pie || medio.alt}</Typography>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 13, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>
            <OpenInFullIcon sx={{ fontSize: 16 }} />{esVideo ? 'Pulsa para verlo' : 'Pulsa para ampliar'}
          </Box>
        </Box>

        {varios && (
          <>
            <IconButton aria-label="Anterior" onClick={() => onIr(actual - 1)} sx={{ ...botonRedondo(56), position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }}><ChevronLeftIcon /></IconButton>
            <IconButton aria-label="Siguiente" onClick={() => onIr(actual + 1)} sx={{ ...botonRedondo(56), position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}><ChevronRightIcon /></IconButton>
          </>
        )}
      </Box>

      {varios && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mt: 2 }}>
          {!quieta && (
            <IconButton aria-label={pausa ? 'Reanudar el pase' : 'Pausar el pase'} onClick={() => setPausa((p) => !p)} sx={{ ...botonRedondo(44), flexShrink: 0, bgcolor: 'transparent' }}>
              {pausa ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
            </IconButton>
          )}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'thin' }}>
            {medios.map((m, i) => {
              const activo = i === actual
              return (
                <ButtonBase
                  key={`${imagenDe(m)}-${i}`}
                  onClick={() => onIr(i)}
                  aria-label={`Ver: ${m.alt}`}
                  aria-current={activo ? 'true' : undefined}
                  sx={{ position: 'relative', flex: '0 0 112px', height: 72, borderRadius: 1, overflow: 'hidden', opacity: activo ? 1 : 0.55, outline: activo ? `2px solid ${DORADO}` : 'none', outlineOffset: 2, transition: 'opacity 200ms', '&:hover': { opacity: 1 } }}
                >
                  <Box component="img" src={imagenDe(m)} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {m.tipo === 'video' && (
                    <Box aria-hidden="true" sx={{ position: 'absolute', right: 6, bottom: 6, width: 22, height: 22, borderRadius: '50%', bgcolor: 'rgba(16,14,17,0.7)', color: DORADO, display: 'grid', placeItems: 'center' }}>
                      <PlayArrowIcon sx={{ fontSize: 14 }} />
                    </Box>
                  )}
                  {activo && enMarcha && (
                    <Box key={actual} aria-hidden="true" sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, bgcolor: DORADO, transformOrigin: 'left', animation: `${avanza} ${DURACION_PASE}ms linear` }} />
                  )}
                </ButtonBase>
              )
            })}
          </Box>
        </Box>
      )}
    </Box>
  )
}
