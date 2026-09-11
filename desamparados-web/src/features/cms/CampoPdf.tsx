import { useId, useState, type ChangeEvent } from 'react'
import { Alert, Box, Button, CircularProgress, Link, Stack, Typography } from '@mui/material'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { subirPdfPublico } from '../../lib/api/upload'

// El mismo tope que la subida del servidor para los PDF (upload.middleware.ts):
// se avisa antes de mandar 30 MB para que el servidor los rechace.
export const MAX_BYTES_PDF = 20 * 1024 * 1024

/** El PDF de relleno de las publicaciones de ejemplo (prisma/seed-contenido.ts). */
const PDF_DE_RELLENO = '/storage/public/documentos/pendiente.pdf'

// El input queda oculto a la vista pero no a la accesibilidad: lo activa su etiqueta, que es el botón.
const inputOculto = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const

interface CampoPdfProps {
  /** Ruta del PDF actual (`/storage/public/….pdf`) o cadena vacía si no hay. */
  valor: string
  onCambio: (ruta: string) => void
  etiqueta?: string
  ayuda?: string
}

const esPdf = (archivo: File) => archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name)

/**
 * Sube el PDF de una publicación desde el CMS y entrega su ruta al formulario.
 * Antes era una casilla de texto «URL del archivo PDF»: no había forma de subir
 * el boletín desde el propio CMS.
 */
export default function CampoPdf({
  valor,
  onCambio,
  etiqueta = 'Archivo PDF',
  ayuda = 'PDF de hasta 20 MB. Es lo que se descarga desde la web.',
}: CampoPdfProps) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El servidor guarda el archivo con un nombre aleatorio: el que se enseña es
  // el del archivo que ha elegido el editor, mientras siga siendo el mismo.
  const [subido, setSubido] = useState<{ ruta: string; nombre: string } | null>(null)
  const idEtiqueta = useId()

  const elegir = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0]
    // Se vacía para poder volver a elegir el mismo archivo después de un error.
    evento.target.value = ''
    if (!archivo) return
    setError(null)
    if (!esPdf(archivo)) {
      setError('El archivo tiene que ser un PDF.')
      return
    }
    if (archivo.size > MAX_BYTES_PDF) {
      setError('El PDF pesa más de 20 MB. Redúcelo (por ejemplo, exportándolo con menos calidad de imagen) antes de subirlo.')
      return
    }
    setSubiendo(true)
    try {
      const ruta = await subirPdfPublico(archivo)
      setSubido({ ruta, nombre: archivo.name })
      onCambio(ruta)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido subir el PDF.')
    } finally {
      setSubiendo(false)
    }
  }

  const nombre = subido?.ruta === valor
    ? subido.nombre
    : valor === PDF_DE_RELLENO
      ? 'PDF de relleno: sustitúyelo por el real'
      : 'PDF actual'

  return (
    <Box role="group" aria-labelledby={idEtiqueta}>
      <Typography id={idEtiqueta} variant="subtitle2" sx={{ mb: 1 }}>{etiqueta}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, flex: { sm: 1 } }}>
          <PictureAsPdfOutlinedIcon color={valor ? 'error' : 'disabled'} />
          {valor ? (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap title={nombre}>{nombre}</Typography>
              <Link href={valor} target="_blank" rel="noopener noreferrer" variant="caption">Abrir el PDF</Link>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Sin PDF</Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            component="label"
            variant="outlined"
            disabled={subiendo}
            startIcon={subiendo ? <CircularProgress size={16} /> : <UploadFileOutlinedIcon />}
          >
            {subiendo ? 'Subiendo…' : valor ? 'Cambiar PDF' : 'Subir PDF'}
            <Box component="input" type="file" accept="application/pdf,.pdf" onChange={elegir} sx={inputOculto} />
          </Button>
          {valor && (
            <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => onCambio('')} disabled={subiendo}>
              Quitar PDF
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
