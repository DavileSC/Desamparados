import { z } from 'zod'

export const membershipSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  apellidos: z.string().min(1, 'Los apellidos son obligatorios'),
  email: z.string().email('Introduce un email válido'),
  telefono: z.string().min(1, 'El teléfono es obligatorio'),
  direccion: z.string().min(1, 'La dirección es obligatoria'),
  ciudad: z.string().min(1, 'La ciudad es obligatoria'),
  codigoPostal: z.string().min(1, 'El código postal es obligatorio'),
  aceptarPolitica: z.boolean().refine((value) => value === true, {
    message: 'Debes aceptar la política de privacidad',
  }),
})

export type MembershipFormData = z.infer<typeof membershipSchema>
