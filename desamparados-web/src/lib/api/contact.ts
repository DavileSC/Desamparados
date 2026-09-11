import { apiFetch } from './client'
import type { ContactFormData } from '../../features/contact/schema'

/**
 * `tiempoRelleno` son los milisegundos entre que se abrió el formulario y se
 * envió, medidos aquí en el navegador. El servidor descarta en silencio lo que
 * llega en menos de 3 segundos o con el campo trampa relleno (un robot): se
 * manda la duración y no la hora de apertura porque restarla allí mezclaría el
 * reloj de este ordenador con el del servidor.
 */
export function sendContactMessage(data: ContactFormData, tiempoRelleno: number) {
  return apiFetch<{ message: string }>('/contact', { method: 'POST', json: { ...data, comentarioAdicional: data.comentarioAdicional ?? '', tiempoRelleno }, auth: false })
}
