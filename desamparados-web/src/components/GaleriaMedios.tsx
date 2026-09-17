import { useCallback, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { Box, Dialog, IconButton, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'
import type { MedioGaleria } from '../lib/api/contenido'

/**
 * Pase de fotos y vídeos.
 *
 * El vídeo se enseña con una **portada nuestra** y no se carga el marco de
 * YouTube hasta que alguien pulsa el play: incrustarlo de entrada deja cookies
 * de terceros y avisa a YouTube de cada visita, sin que el visitante haya
 * pedido ver nada. La dirección ya viene normalizada del servidor a la forma
 * `-nocookie` (`domain/video-galeria.ts`), así que aquí no se decide nada sobre
 * seguridad: solo se pinta lo que llega.
 *
 * Las flechas solo salen si hay más de un medio: un carrusel de uno no se
 * desplaza, y unas flechas muertas confunden.
 */
export default function GaleriaMedios({ medios }: { medios: MedioGaleria[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center' })
  const [ampliada, setAmpliada] = useState<MedioGaleria | null>(null)
  // Vídeos a los que ya se ha dado al play: solo esos cargan su marco.
  const [reproduciendo, setReproduciendo] = useState<string[]>([])

  const anterior = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const siguiente = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  if (medios.length === 0) return null

  const variasDiapositivas = medios.length > 1

  return (
    <Box sx={{ position: 'relative' }}>
      <Box ref={emblaRef} sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', touchAction: 'pan-y' }}>
          {medios.map((medio, indice) => (
            <Box
              key={`${medio.url}-${indice}`}
              sx={{ flex: '0 0 100%', minWidth: 0, position: 'relative' }}
            >
              <Box sx={{ position: 'relative', aspectRatio: '16 / 9', backgroundColor: 'rgba(0,0,0,0.35)' }}>
                {medio.tipo === 'video' && reproduciendo.includes(medio.url) ? (
                  <Box
                    component="iframe"
                    src={`${medio.url}${medio.url.includes('?') ? '&' : '?'}autoplay=1`}
                    title={medio.alt}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sx={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                  />
                ) : (
                  <>
                    <Box
                      component="img"
                      src={medio.tipo === 'video' ? medio.portada : medio.url}
                      alt={medio.alt}
                      loading="lazy"
                      decoding="async"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <IconButton
                      onClick={() => (medio.tipo === 'video'
                        ? setReproduciendo((actuales) => [...actuales, medio.url])
                        : setAmpliada(medio))}
                      aria-label={medio.tipo === 'video' ? `Reproducir: ${medio.alt}` : `Ampliar: ${medio.alt}`}
                      sx={{
                        position: 'absolute', inset: 0, m: 'auto',
                        width: 72, height: 72,
                        color: 'common.white',
                        backgroundColor: 'rgba(0,0,0,0.45)',
                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.65)' },
                      }}
                    >
                      {medio.tipo === 'video' ? <PlayArrowIcon sx={{ fontSize: 40 }} /> : <ZoomOutMapIcon sx={{ fontSize: 30 }} />}
                    </IconButton>
                  </>
                )}
              </Box>
              {medio.pie && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center' }}>
                  {medio.pie}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {variasDiapositivas && (
        <>
          {/* Con el carrusel en bucle siempre hay a dónde ir: no hay estado
              que derivar ni flechas que deshabilitar. */}
          <FlechaCarrusel lado="left" etiqueta="Medio anterior" onClick={anterior}>
            <ChevronLeftIcon />
          </FlechaCarrusel>
          <FlechaCarrusel lado="right" etiqueta="Medio siguiente" onClick={siguiente}>
            <ChevronRightIcon />
          </FlechaCarrusel>
        </>
      )}

      <Dialog
        open={ampliada !== null}
        onClose={() => setAmpliada(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { backgroundColor: 'rgba(16, 14, 17, 0.95)', boxShadow: 'none' } } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <IconButton onClick={() => setAmpliada(null)} aria-label="Cerrar" sx={{ position: 'absolute', top: 8, right: 8, color: 'common.white', zIndex: 1 }}>
            <CloseIcon />
          </IconButton>
          {ampliada && (
            <Box
              component="img"
              src={ampliada.url}
              alt={ampliada.alt}
              sx={{ maxWidth: '100%', maxHeight: { xs: '70vh', md: '80vh' }, objectFit: 'contain' }}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  )
}

function FlechaCarrusel({ lado, etiqueta, onClick, children }: {
  lado: 'left' | 'right'
  etiqueta: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <IconButton
      onClick={onClick}
      aria-label={etiqueta}
      sx={{
        position: 'absolute',
        top: '50%',
        [lado]: { xs: 4, md: -20 },
        transform: 'translateY(-50%)',
        color: 'common.white',
        backgroundColor: 'rgba(0,0,0,0.45)',
        '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
      }}
    >
      {children}
    </IconButton>
  )
}
