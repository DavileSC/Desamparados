import { apiFetch } from './client'
import type { ContactFormData } from '../../features/contact/schema'

export function sendContactMessage(data: ContactFormData) {
  return apiFetch<{ message: string }>('/contact', { method: 'POST', json: data, auth: false })
}
