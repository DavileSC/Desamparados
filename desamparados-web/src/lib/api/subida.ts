import { llamarApi } from './cliente'

interface RespuestaSubida {
  message: string
  data: { url: string; filename: string; type: string; size: string }
}

/**
 * Sube un archivo a la carpeta pública del servidor y devuelve su ruta relativa
 * (`/storage/public/…`). Se guarda la ruta y no la URL absoluta que devuelve el
 * backend: así el contenido no queda atado al dominio del servidor, y además es
 * lo único que admiten los esquemas del backend (nada de URLs externas).
 */
async function subirArchivoPublico(archivo: File): Promise<string> {
  const formulario = new FormData()
  formulario.append('file', archivo)
  const respuesta = await llamarApi<RespuestaSubida>('/upload/public', { method: 'POST', formData: formulario })
  return `/storage/public/${encodeURIComponent(respuesta.data.filename)}`
}

/** Una foto (JPG, PNG o WebP de hasta 5 MB). El servidor la guarda sin sus metadatos. */
export function subirImagenPublica(archivo: File): Promise<string> {
  return subirArchivoPublico(archivo)
}

/** Un PDF (hasta 20 MB): el de una publicación. Se guarda tal cual. */
export function subirPdfPublico(archivo: File): Promise<string> {
  return subirArchivoPublico(archivo)
}

/** Dónde va un vídeo: cada sitio tiene su tope de peso y de duración (`shared/topes-video.json`). */
export type UsoDeVideo = 'hero' | 'galeria'

/**
 * Un vídeo MP4 (H.264) ya preparado para la web. El servidor no lo recomprime:
 * comprueba que cumple los topes de su uso y lo guarda tal cual.
 */
export async function subirVideoPublico(archivo: File, uso: UsoDeVideo): Promise<string> {
  const formulario = new FormData()
  formulario.append('file', archivo)
  const respuesta = await llamarApi<RespuestaSubida>(`/upload/video/${uso}`, { method: 'POST', formData: formulario })
  return `/storage/public/${encodeURIComponent(respuesta.data.filename)}`
}
