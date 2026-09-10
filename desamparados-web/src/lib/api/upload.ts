import { apiFetch } from './client'

interface RespuestaSubida {
  message: string
  data: { url: string; filename: string; type: string; size: string }
}

/**
 * Sube una imagen a la carpeta pública del servidor y devuelve su ruta relativa
 * (`/storage/public/…`). Se guarda la ruta y no la URL absoluta que devuelve el
 * backend: así el contenido no queda atado al dominio del servidor.
 */
export async function subirImagenPublica(archivo: File): Promise<string> {
  const formulario = new FormData()
  formulario.append('file', archivo)
  const respuesta = await apiFetch<RespuestaSubida>('/upload/public', { method: 'POST', formData: formulario })
  return `/storage/public/${encodeURIComponent(respuesta.data.filename)}`
}
