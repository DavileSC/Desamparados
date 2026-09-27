import { Box } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import type { MedioGaleria } from '../../lib/api/contenido'
import { esVideoPropio } from '../../lib/videoPropio'

const entra = keyframes`from { opacity: 0 } to { opacity: 1 }`

/**
 * Un vídeo de la galería reproduciéndose en su sitio, sin abrir el visor: en
 * el escenario de escritorio y en el carril del móvil. Solo se monta cuando
 * alguien le da al play, y se desmonta al pasar a otro medio, con lo que deja
 * de descargarse: un clip nuestro no cuesta nada a quien no lo ve, y uno de
 * YouTube no carga su marco (ni sus cookies) hasta entonces.
 *
 * Ocupa todo el hueco y se ve entero (`contain`): un vídeo grabado en vertical
 * queda en vertical, con negro a los lados, como en el propio móvil.
 */
export default function ReproductorEnLinea({ medio, onTerminar }: {
  medio: MedioGaleria
  /** Al acabar un clip nuestro. Los de YouTube no avisan: siguen ahí hasta que se pase. */
  onTerminar: () => void
}) {
  const hueco = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', border: 0, bgcolor: '#000', animation: `${entra} 240ms ease-out` } as const
  if (esVideoPropio(medio.url)) {
    return (
      <Box
        component="video"
        src={medio.url}
        poster={medio.portada}
        aria-label={medio.alt}
        controls
        autoPlay
        playsInline
        preload="auto"
        onEnded={onTerminar}
        sx={{ ...hueco, objectFit: 'contain' }}
      />
    )
  }
  return (
    <Box
      component="iframe"
      src={`${medio.url}${medio.url.includes('?') ? '&' : '?'}autoplay=1`}
      title={medio.alt}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      sx={hueco}
    />
  )
}
