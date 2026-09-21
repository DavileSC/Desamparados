import { useId, useState, type ChangeEvent } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { subirImagenPublica } from '../../lib/api/subida'

// Los mismos límites que la subida del servidor (upload.middleware.ts): se avisa antes de enviar.
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

// El input queda oculto a la vista pero no a la accesibilidad: lo activa su etiqueta, que es el botón.
const inputOculto = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const

interface CampoImagenProps {
  /** Ruta de la imagen actual (`/storage/public/…`) o cadena vacía si no hay. */
  valor: string
  onCambio: (ruta: string) => void
  etiqueta?: string
  /** Pie bajo los botones; por defecto habla de la noticia. */
  ayuda?: string
  /** Miniatura 16:9 en vez de 4:3, para fotos de cabecera. */
  apaisada?: boolean
  /**
   * No pinta el botón de quitar: la foto se puede cambiar, pero no dejar vacía.
   *
   * Para los campos que el backend exige rellenos. El `imagenUrl` del bloque del
   * Sábado de Pasión es uno: `contenido.schema.ts` lo valida con
   * `rutaImagenPublica`, que NO admite cadena vacía —al revés que el `plano.url`
   * del recorrido, que la contempla a propósito—. Ofrecer ahí un «Quitar foto»
   * deja el documento entero inguardable, también los textos de los otros cinco
   * bloques, con un error de validación por toda explicación.
   */
  sinQuitar?: boolean
  /** Foto a todo el ancho y botones debajo: para una columna estrecha, como la lateral de la ficha de noticia. */
  apilada?: boolean
  /** Con `apilada`: una portada en vertical (3:4), centrada y no a todo el ancho. */
  vertical?: boolean
}

/** Sube una foto al servidor desde el CMS y entrega su ruta al formulario. */
export default function CampoImagen({
  valor,
  onCambio,
  etiqueta = 'Foto de la noticia',
  // Lo de quitar o cambiar no es solo de la ficha: al guardar, el servidor
  // borra la foto anterior si nada más la usa (backend: utils/ficheros-publicos.ts).
  ayuda = 'JPG, PNG o WebP de hasta 5 MB. Se verá en la portada y en la ficha de la noticia. Al quitarla o cambiarla y guardar, la anterior se borra del servidor.',
  apaisada = false,
  sinQuitar = false,
  apilada = false,
  vertical = false,
}: CampoImagenProps) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idEtiqueta = useId()
  const miniatura = apilada
    ? vertical ? { width: 168, maxWidth: '100%', aspectRatio: '3 / 4', alignSelf: 'center' } : { width: '100%', aspectRatio: '4 / 3' }
    : apaisada ? { width: 224, aspectRatio: '16 / 9' } : { width: 160, aspectRatio: '4 / 3' }

  const elegir = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0]
    // Se vacía para poder volver a elegir el mismo archivo después de un error.
    evento.target.value = ''
    if (!archivo) return
    setError(null)
    if (!TIPOS.includes(archivo.type)) {
      setError('La foto tiene que ser JPG, PNG o WebP.')
      return
    }
    if (archivo.size > MAX_BYTES) {
      setError('La foto pesa más de 5 MB. Redúcela antes de subirla.')
      return
    }
    setSubiendo(true)
    try {
      onCambio(await subirImagenPublica(archivo))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Box role="group" aria-labelledby={idEtiqueta}>
      <Typography id={idEtiqueta} variant="subtitle2" sx={{ mb: 1 }}>{etiqueta}</Typography>
      <Stack direction={apilada ? 'column' : { xs: 'column', sm: 'row' }} spacing={apilada ? 1.25 : 2} sx={{ alignItems: apilada ? 'stretch' : { sm: 'center' } }}>
        {valor ? (
          <Box component="img" src={valor} alt="Foto actual" sx={{ ...miniatura, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
        ) : (
          <Box sx={{ ...miniatura, display: 'grid', placeItems: 'center', borderRadius: 1, border: '1px dashed', borderColor: 'divider', color: 'text.secondary', fontSize: 13 }}>
            Sin foto
          </Box>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            component="label"
            variant="outlined"
            disabled={subiendo}
            startIcon={subiendo ? <CircularProgress size={16} /> : <AddPhotoAlternateOutlinedIcon />}
          >
            {subiendo ? 'Subiendo…' : valor ? 'Cambiar foto' : 'Subir foto'}
            <Box component="input" type="file" accept={TIPOS.join(',')} onChange={elegir} sx={inputOculto} />
          </Button>
          {valor && !sinQuitar && (
            <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => onCambio('')} disabled={subiendo}>
              Quitar foto
            </Button>
          )}
        </Stack>
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
        {ayuda}
      </Typography>
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    </Box>
  )
}
