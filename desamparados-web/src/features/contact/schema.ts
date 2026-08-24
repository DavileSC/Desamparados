import { z } from 'zod'

export const contactSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Introduce un email válido'),
  telefono: z.string().min(1, 'El teléfono es obligatorio'),
  asunto: z.string().min(1, 'El asunto es obligatorio'),
  mensaje: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
})

export type ContactFormData = z.infer<typeof contactSchema>
