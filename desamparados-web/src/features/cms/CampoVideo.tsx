import { useId, useState, type ChangeEvent } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import VideoFileOutlinedIcon from '@mui/icons-material/VideoFileOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { subirImagenPublica, subirVideoPublico, type UsoDeVideo } from '../../lib/api/subida'
import { leerVideo, problemaDelVideo, reglasDe, sacarFotograma } from './video/comprobarVideo'

// El input queda oculto a la vista pero no a la accesibilidad: lo activa su etiqueta, que es el botón.
const inputOculto = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const

interface CampoVideoProps {
  /** Ruta del vídeo actual (`/storage/public/….mp4`) o cadena vacía si no hay. */
  valor: string
  /** Con `conPortada`, llega también la foto sacada del vídeo, si se pudo sacar. */
  onCambio: (ruta: string, portada?: string) => void
  /** Dónde va: decide el tope de peso y de duración. */
  uso: UsoDeVideo
  etiqueta?: string
  /** Lo que se añade a las reglas, bajo los botones. */
  ayuda?: string
  /**
   * Al subir el vídeo, sacar una foto suya y subirla como portada. Se entrega
   * junto con el vídeo, en el mismo `onCambio`: por separado, el segundo
   * cambio se haría sobre el formulario de antes del primero y lo pisaría.
   */
  conPortada?: boolean
}

/**
 * Sube un vídeo corto desde el CMS. Comprueba en el navegador el formato, el
 * peso, la duración y el tamaño antes de enviar nada; el servidor lo vuelve a
 * comprobar (y además mira el códec y lo pasa por el antivirus), pero no lo
 * recomprime: el vídeo tiene que llegar ya preparado para la web.
 */
export default function CampoVideo({ valor, onCambio, uso, etiqueta = 'Vídeo', ayuda = '', conPortada = false }: CampoVideoProps) {
  const [estado, setEstado] = useState<'quieto' | 'comprobando' | 'subiendo'>('quieto')
  const [error, setError] = useState<string | null>(null)
  const idEtiqueta = useId()
  const ocupado = estado !== 'quieto'

  const elegir = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0]
    // Se vacía para poder volver a elegir el mismo archivo después de un error.
    evento.target.value = ''
    if (!archivo) return
    setError(null)
    setEstado('comprobando')
    try {
      const problema = problemaDelVideo(archivo, await leerVideo(archivo), uso)
      if (problema) {
        setError(problema)
        return
      }
      setEstado('subiendo')
      const ruta = await subirVideoPublico(archivo, uso)
      // Si la foto no sale, el vídeo sube igual y la portada se pone a mano.
      const foto = conPortada ? await sacarFotograma(archivo) : null
      const portada = foto ? await subirImagenPublica(foto).catch(() => '') : ''
      onCambio(ruta, portada || undefined)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido subir el vídeo.')
    } finally {
      setEstado('quieto')
    }
  }

  const textoBoton = estado === 'comprobando' ? 'Comprobando…' : estado === 'subiendo' ? 'Subiendo…' : valor ? 'Cambiar vídeo' : 'Subir vídeo'

  return (
    <Box role="group" aria-labelledby={idEtiqueta}>
      <Typography id={idEtiqueta} variant="subtitle2" sx={{ mb: 1 }}>{etiqueta}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
        {valor ? (
          // Solo los datos del principio hasta que alguien le dé al play: el
          // editor no se descarga el vídeo entero por abrir la pantalla.
          <Box component="video" src={valor} controls muted preload="metadata" aria-label="Vídeo actual"
            sx={{ width: 224, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: '#000' }} />
        ) : (
          <Box sx={{ width: 224, aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', borderRadius: 1, border: '1px dashed', borderColor: 'divider', color: 'text.secondary', fontSize: 13 }}>
            Sin vídeo
          </Box>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            component="label"
            variant="outlined"
            disabled={ocupado}
            startIcon={ocupado ? <CircularProgress size={16} /> : <VideoFileOutlinedIcon />}
          >
            {textoBoton}
            <Box component="input" type="file" accept="video/mp4,.mp4" onChange={elegir} sx={inputOculto} />
          </Button>
          {valor && (
            <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => onCambio('')} disabled={ocupado}>
              Quitar vídeo
            </Button>
          )}
        </Stack>
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
        {reglasDe(uso)} Si viene del móvil, pásalo antes por HandBrake (gratuito): formato MP4, códec H.264 y
        «Optimizado para web» marcado. {ayuda}
      </Typography>
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    </Box>
  )
}
