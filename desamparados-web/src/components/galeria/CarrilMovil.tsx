import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import type { MedioGaleria } from '../../lib/api/contenido'
import { DORADO, fondoDesenfocado, imagenDe, type Medida } from './formato'
import ReproductorEnLinea from './ReproductorEnLinea'
import { propsDeFoto } from '../../lib/fotoSubida'

interface Props {
  medios: MedioGaleria[]
  actual: number
  onIr: (indice: number) => void
  onAbrir: (indice: number, reproducir: boolean) => void
  medidaDe: (medio: MedioGaleria) => Medida
  medir: (evento: SyntheticEvent<HTMLImageElement>) => void
  /** Galería de solo vídeos: se reproducen aquí mismo en vez de abrir el visor. */
  enLinea?: boolean
}

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * La galería en el móvil: se pasa deslizando con el dedo y cada foto encaja
 * sola (scroll-snap del navegador, que sigue el gesto como el sistema). Las
 * horizontales llenan el recuadro; las verticales se ven enteras sobre su
 * propio fondo desenfocado. Tocar una foto la abre a pantalla completa. En una
 * galería de solo vídeos, tocar uno lo reproduce ahí mismo, y deslizar a otro
 * lo para; si hay fotos, el vídeo se abre a pantalla completa como ellas.
 */
export default function CarrilMovil({ medios, actual, onIr, onAbrir, medidaDe, medir, enLinea = false }: Props) {
  const carril = useRef<HTMLDivElement>(null)
  const varios = medios.length > 1
  // El que se está reproduciendo: al deslizar a otro deja de ser el actual y se desmonta.
  const [sonando, setSonando] = useState<number | null>(null)

  // La que acaba de marcar el propio dedo. El índice cambia a mitad del gesto,
  // y si el carril corriera tras él cortaría el deslizamiento de golpe.
  const marcada = useRef<number | null>(null)

  // Si `actual` cambia desde fuera (al cerrar el visor en otra foto), el carril la sigue.
  useEffect(() => {
    if (actual === marcada.current) return
    marcada.current = actual
    const el = carril.current
    if (!el || !el.clientWidth) return
    const destino = actual * el.clientWidth
    if (Math.abs(el.scrollLeft - destino) > 4) el.scrollTo({ left: destino })
  }, [actual])

  const alDeslizar = () => {
    const el = carril.current
    if (!el || !el.clientWidth) return
    const indice = Math.round(el.scrollLeft / el.clientWidth)
    if (indice !== actual && indice >= 0 && indice < medios.length) {
      marcada.current = indice
      onIr(indice)
    }
  }

  const medio = medios[actual]

  return (
    <Box>
      <Box sx={{ position: 'relative', mx: { xs: '-20px', sm: 0 } }}>
        <Box
          ref={carril}
          onScroll={alDeslizar}
          sx={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, borderRadius: { sm: 1.5 } }}
        >
          {medios.map((m, i) => {
            const esVideo = m.tipo === 'video'
            const { formato } = medidaDe(m)
            const hueco = { position: 'relative', flex: '0 0 100%', aspectRatio: '4 / 5', maxHeight: '70vh', scrollSnapAlign: 'start', overflow: 'hidden', bgcolor: '#070608' } as const
            if (esVideo && sonando === i && i === actual) {
              return (
                <Box key={`${imagenDe(m)}-${i}`} sx={hueco}>
                  <ReproductorEnLinea medio={m} onTerminar={() => setSonando(null)} />
                </Box>
              )
            }
            return (
              <ButtonBase
                key={`${imagenDe(m)}-${i}`}
                // El que se toca pasa a ser el actual: si el carril aún no había
                // acabado de encajar, el vídeo no sonaría.
                onClick={() => { if (esVideo && enLinea) { onIr(i); setSonando(i) } else onAbrir(i, esVideo) }}
                aria-label={esVideo ? `Reproducir: ${m.alt}` : `Ampliar: ${m.alt}`}
                // Sin la onda de MUI: empieza al poner el dedo para deslizar y
                // se ve como un círculo gris que crece sobre la foto.
                disableRipple
                sx={{ ...hueco, '&.Mui-focusVisible': { outline: `3px solid ${DORADO}`, outlineOffset: -3 } }}
              >
                <Box component="img" {...propsDeFoto(imagenDe(m), '320px')} alt="" aria-hidden="true" loading={Math.abs(i - actual) <= 1 ? 'eager' : 'lazy'} sx={fondoDesenfocado(26, 0.45)} />
                <Box
                  component="img"
                  {...propsDeFoto(imagenDe(m), '100vw')}
                  alt={m.alt}
                  // Las vecinas, ya cargadas: si no, aparecen de golpe al deslizar.
                  loading={Math.abs(i - actual) <= 1 ? 'eager' : 'lazy'}
                  data-medida={imagenDe(m)}
                  onLoad={medir}
                  sx={{ position: 'relative', width: '100%', height: '100%', display: 'block', objectFit: formato === 'h' ? 'cover' : 'contain' }}
                />
                {esVideo && (
                  <Box aria-hidden="true" sx={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 72, height: 72, borderRadius: '50%', border: `2px solid ${DORADO}`, bgcolor: 'rgba(7,6,8,0.55)', color: DORADO, display: 'grid', placeItems: 'center' }}>
                    <PlayArrowIcon sx={{ fontSize: 34 }} />
                  </Box>
                )}
              </ButtonBase>
            )
          })}
        </Box>
        {varios && (
          <Box aria-hidden="true" sx={{ position: 'absolute', top: 14, right: 14, height: 28, px: 1.5, display: 'inline-flex', alignItems: 'center', borderRadius: 999, bgcolor: 'rgba(7,6,8,0.65)', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
            {dos(actual + 1)} / {dos(medios.length)}
          </Box>
        )}
      </Box>

      {varios && (
        <Box aria-hidden="true" sx={{ display: 'flex', gap: 0.75, mt: 2 }}>
          {medios.map((m, i) => (
            <Box key={`${imagenDe(m)}-punto-${i}`} sx={{ height: 4, width: i === actual ? 22 : 8, borderRadius: 2, bgcolor: i === actual ? DORADO : 'rgba(255,255,255,0.3)', transition: 'width 300ms, background-color 300ms' }} />
          ))}
        </Box>
      )}
      {(medio.pie || varios) && (
        <Typography sx={{ mt: 1.5, fontSize: 17, fontWeight: 500, lineHeight: 1.35 }}>{medio.pie}</Typography>
      )}
      {varios && (
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {medio.tipo === 'video' ? 'Desliza para pasar · toca para verlo' : 'Desliza para pasar · toca para verla en grande'}
        </Typography>
      )}
    </Box>
  )
}
