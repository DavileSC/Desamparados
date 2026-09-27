import { useState } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { valorDe } from './presentacion'
import type { BloqueVideo as Datos } from '../../lib/api/contenido'
import { esVideoPropio } from '../../lib/videoPropio'

const ANCHOS = { mediana: '720px', grande: '1000px', completa: 'none' } as const

/**
 * Un vídeo de YouTube o Vimeo, o un clip subido desde el CMS, en su sitio, a 16:9.
 *
 * Hasta que alguien pulsa el play se enseña la portada nuestra y no se carga
 * nada de YouTube: incrustarlo de entrada deja cookies de terceros y avisa de
 * cada visita, sin que nadie haya pedido ver nada. La dirección llega del
 * servidor ya en su forma sin cookies (`youtube-nocookie`, `player.vimeo`).
 * Con un clip nuestro pasa lo mismo por otra razón: hasta el play no se
 * descarga, y la mayoría de las visitas no le dan.
 */
export default function BloqueVideo({ bloque }: { bloque: Datos }) {
  const [reproduciendo, setReproduciendo] = useState(false)
  if (bloque.url === '' || bloque.portada === '') return null
  const tamano = valorDe(bloque, 'tamano') as keyof typeof ANCHOS
  const completa = tamano === 'completa'
  const separador = bloque.url.includes('?') ? '&' : '?'

  return (
    <Box component="figure" sx={{ m: 0, mx: completa ? 'calc(50% - 50vw)' : 'auto', maxWidth: ANCHOS[tamano] ?? ANCHOS.grande }}>
      <Box sx={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: completa ? 0 : 2, backgroundColor: '#000' }}>
        {reproduciendo && esVideoPropio(bloque.url) ? (
          <Box component="video" src={bloque.url} poster={bloque.portada} aria-label={bloque.alt}
            controls autoPlay playsInline preload="auto"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', bgcolor: '#000' }} />
        ) : reproduciendo ? (
          <Box component="iframe" src={`${bloque.url}${separador}autoplay=1`} title={bloque.alt}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
        ) : (
          <ButtonBase onClick={() => setReproduciendo(true)} aria-label={`Ver el vídeo: ${bloque.alt}`}
            sx={{ position: 'absolute', inset: 0, '&.Mui-focusVisible': { outline: '3px solid #dec72b', outlineOffset: -3 } }}>
            <Box component="img" src={bloque.portada} alt="" loading="lazy" decoding="async"
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <Box aria-hidden sx={{
              position: 'relative', display: 'grid', placeItems: 'center', width: { xs: 64, md: 84 }, height: { xs: 64, md: 84 },
              borderRadius: '50%', backgroundColor: 'rgba(110, 24, 34, 0.88)', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            }}>
              <PlayArrowRoundedIcon sx={{ fontSize: { xs: 38, md: 50 } }} />
            </Box>
          </ButtonBase>
        )}
      </Box>
      {bloque.pie && (
        <Typography component="figcaption" variant="body2" sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center', px: completa ? 2 : 0 }}>
          {bloque.pie}
        </Typography>
      )}
    </Box>
  )
}
