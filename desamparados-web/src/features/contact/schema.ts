import { z } from 'zod'

/**
 * Las mismas reglas que el servidor (backend: schemas/contact.schema.ts), para
 * avisar en el formulario en vez de devolver un error genérico al enviar.
 */

// El email acaba en el «Responder a» del correo de la secretaría: solo los
// caracteres de una dirección normal, sin comas, espacios, comillas ni <>.
const EMAIL_VISITANTE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/

/** Opcional; con o sin prefijo internacional, entre 6 y 15 cifras. */
export function telefonoValido(valor: string): boolean {
  if (valor.trim() === '') return true
  if (!/^\+?[0-9 ().-]+$/.test(valor.trim())) return false
  const cifras = valor.replace(/\D/g, '').length
  return cifras >= 6 && cifras <= 15
}

const SIN_ANGULOS = /^[^<>]*$/

export const contactSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(160, 'El nombre es demasiado largo').regex(SIN_ANGULOS, 'El nombre no puede llevar los caracteres < ni >'),
  email: z.string().trim().max(254, 'El email es demasiado largo').regex(EMAIL_VISITANTE, 'Introduce un email válido'),
  telefono: z.string().trim().refine(telefonoValido, 'Introduce un teléfono válido (puede llevar el prefijo del país, como +34)'),
  asunto: z.string().trim().min(1, 'El asunto es obligatorio').max(160, 'El asunto es demasiado largo').regex(SIN_ANGULOS, 'El asunto no puede llevar los caracteres < ni >'),
  mensaje: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres').max(5000, 'El mensaje no puede pasar de 5000 caracteres'),
  // Campo trampa: está escondido y una persona lo deja vacío. Ver ContactPage.
  comentarioAdicional: z.string().optional(),
})

export type ContactFormData = z.infer<typeof contactSchema>
