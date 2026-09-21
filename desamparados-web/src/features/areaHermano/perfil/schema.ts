import { z } from 'zod'

export const profileSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  surname: z.string().min(1, 'Los apellidos son obligatorios'),
  email: z.string().email('Introduce un email válido'),
  phone: z.string().min(1, 'El teléfono es obligatorio'),
  address: z.string().min(1, 'La dirección es obligatoria'),
  city: z.string().min(1, 'La ciudad es obligatoria'),
  postalCode: z.string().min(1, 'El código postal es obligatorio'),
})

export type ProfileFormData = z.infer<typeof profileSchema>
