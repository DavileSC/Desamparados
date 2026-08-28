import { z } from 'zod'
import { contrasenaNueva } from '../../../lib/passwordPolicy'

export const membershipSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  apellidos: z.string().min(1, 'Los apellidos son obligatorios'),
  email: z.string().email('Introduce un email válido'),
  password: contrasenaNueva,
  dni: z.string().regex(/^[XYZ]?\d{7,8}[A-Z]$/i, 'Introduce un DNI o NIE válido'),
  telefono: z.string().min(1, 'El teléfono es obligatorio'),
  direccion: z.string().min(1, 'La dirección es obligatoria'),
  ciudad: z.string().min(1, 'La ciudad es obligatoria'),
  codigoPostal: z.string().regex(/^\d{5}$/, 'El código postal debe tener 5 dígitos'),
  fechaNacimiento: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
  aceptarPolitica: z.boolean().refine((value) => value === true, {
    message: 'Debes aceptar la política de privacidad',
  }),
})

export type MembershipFormData = z.infer<typeof membershipSchema>
