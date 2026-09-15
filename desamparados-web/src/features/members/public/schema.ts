import { z } from 'zod'
import { contrasenaNueva } from '../../../lib/passwordPolicy'
import {
  esDniValido, esTelefonoValido, esCodigoPostalValido, esTextoValido,
} from '../../../lib/validacion/identidad'

/**
 * Las mismas reglas que aplica el servidor (`lib/validacion/identidad.ts`).
 * Antes eran más flojas y el alta se caía con un 400 que no decía qué campo
 * fallaba: el navegador daba por bueno lo que el servidor rechazaba.
 */
const textoLibre = (etiqueta: string) =>
  z.string().refine(esTextoValido, `${etiqueta} es obligatorio y no puede llevar < ni >`)

export const membershipSchema = z.object({
  nombre: textoLibre('El nombre'),
  apellidos: textoLibre('Los apellidos'),
  email: z.string().trim().email('Introduce un email válido').max(254, 'El email es demasiado largo'),
  password: contrasenaNueva,
  dni: z.string().refine(esDniValido, 'Revisa el DNI o NIE: la letra no corresponde con el número'),
  telefono: z.string().refine(esTelefonoValido, 'El teléfono son nueve dígitos'),
  direccion: textoLibre('La dirección'),
  ciudad: textoLibre('La ciudad'),
  codigoPostal: z.string().refine(esCodigoPostalValido, 'El código postal son cinco dígitos'),
  fechaNacimiento: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
  aceptarPolitica: z.boolean().refine((value) => value === true, {
    message: 'Debes aceptar la política de privacidad',
  }),
})

export type MembershipFormData = z.infer<typeof membershipSchema>
