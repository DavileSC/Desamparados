import { useState } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import type { MedioGaleria } from '../../lib/api/contenido'
import { imagenDe } from './formato'
import { propsDeFoto } from '../../lib/fotoSubida'

/**
 * Las fotos en tiras, una al lado de otra: la abierta ocupa casi todo y las
 * demás se quedan en una franja oscurecida con su pie en vertical. Al pasar
 * el ratón (o llegar con el tabulador) se abre otra; pulsar la abierta la
 * amplía en el visor.
 *
 * En el móvil las tiras se apilan: se toca una para abrirla y otra vez para
 * ampliarla. Va mejor con pocas fotos, de tres a ocho, cada una con su pie.
 */
export default function Tiras({ medios, onAbrir }: {
  medios: MedioGaleria[]
  onAbrir: (indice: number, reproducir: boolean) => void
}) {
  const [abierta, setAbierta] = useState(0)
  const cerrada = { xs: 52, md: 0 }
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none', m: 0, p: 0, display: 'flex', gap: '6px',
        flexDirection: { xs: 'column', md: 'row' },
        height: { xs: `min(720px, ${medios.length * 58 + 320}px)`, md: 'clamp(420px, 60vh, 600px)' },
      }}
    >
      {medios.map((medio, i) => {
        const esta = i === abierta
        const video = medio.tipo === 'video'
        return (
          <Box component="li" key={`${medio.url}-${i}`} sx={{
            position: 'relative', minWidth: 0, minHeight: cerrada, flex: `${esta ? 6 : 1} 1 0`,
            transition: 'flex-grow .8s cubic-bezier(.2, .8, .2, 1)',
          }}>
            <ButtonBase
              onMouseEnter={() => setAbierta(i)}
              onFocus={() => setAbierta(i)}
              onClick={() => (esta ? onAbrir(i, video) : setAbierta(i))}
              aria-label={esta
                ? `${video ? 'Ver el vídeo' : 'Ampliar la foto'}: ${medio.alt}`
                : `Abrir: ${medio.pie || medio.alt}`}
              sx={{
                position: 'absolute', inset: 0, overflow: 'hidden', display: 'block', backgroundColor: '#0c0b0d',
                cursor: esta ? 'zoom-in' : 'pointer',
                '&.Mui-focusVisible': { outline: '2px solid #dec72b', outlineOffset: 2 },
              }}
            >
              <Box component="img" {...propsDeFoto(imagenDe(medio), '(min-width: 900px) 50vw, 100vw')} alt="" loading="lazy" decoding="async" sx={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                filter: esta ? 'none' : 'brightness(.55) saturate(.8)', transform: esta ? 'scale(1)' : 'scale(1.12)',
                transition: 'transform 1.2s cubic-bezier(.2, .8, .2, 1), filter .8s',
              }} />
              {medio.pie && (
                <Typography component="span" aria-hidden sx={{
                  position: 'absolute', color: '#fff', fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  opacity: esta ? 0 : 1, transition: 'opacity .4s',
                  // En el ordenador, de abajo arriba por el centro de la tira; en el móvil, tumbado.
                  left: '50%', top: { xs: '50%', md: 'auto' }, bottom: { md: 20 },
                  transform: { xs: 'translate(-50%, -50%)', md: 'translateX(-50%) rotate(180deg)' },
                  writingMode: { md: 'vertical-rl' },
                  maxWidth: { xs: '90%', md: 'none' }, overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {medio.pie}
                </Typography>
              )}
              {video && esta && (
                <Box aria-hidden sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <PlayArrowRoundedIcon sx={{ fontSize: 64, color: '#fff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.6))' }} />
                </Box>
              )}
              {medio.pie && (
                <Typography component="span" aria-hidden sx={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: '48px 16px 14px', md: '60px 24px 22px' },
                  background: 'linear-gradient(transparent, rgba(7,6,8,.85))', color: '#fff', textAlign: 'left',
                  fontSize: { xs: 18, md: 24 }, lineHeight: 1.25,
                  opacity: esta ? 1 : 0, transform: esta ? 'none' : 'translateY(12px)',
                  transition: esta ? 'opacity .5s .25s, transform .5s .25s' : 'opacity .2s, transform .2s',
                }}>
                  {medio.pie}
                </Typography>
              )}
            </ButtonBase>
          </Box>
        )
      })}
    </Box>
  )
}
