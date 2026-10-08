import { z } from 'zod'
import { contrasenaNueva, contrasenaExistente } from '../../../lib/politicaDeContrasena'

// El acceso NO aplica la política: quien tenga una contraseña anterior al
// endurecimiento del mínimo seguiría siendo válida, y rechazarla aquí lo dejaría
// fuera de su cuenta. La comprobación de verdad la hace el backend.
export const loginSchema = z.object({
  email: z.string().trim().email('Introduce un email válido'),
  password: contrasenaExistente,
  recordarme: z.boolean().default(false),
})

// Dos tipos, no uno: `recordarme` lleva `.default(false)`, así que en la ENTRADA
// del esquema es opcional y en la SALIDA ya es un boolean. `useForm` necesita
// ambos —los valores que maneja el formulario y los que entrega el resolver—; con
// uno solo, el `Resolver` de zod no encaja y el typecheck falla.
export type LoginFormInput = z.input<typeof loginSchema>
export type LoginFormData = z.output<typeof loginSchema>

// Segundo paso: código TOTP de 6 dígitos o código de respaldo
export const twoFactorSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, 'Introduce el código de 6 dígitos o un código de respaldo')
    .max(32, 'Código demasiado largo'),
})

export type TwoFactorFormData = z.infer<typeof twoFactorSchema>

// Contraseña nueva: aquí sí se aplica la política completa del backend.
export const resetPasswordSchema = z.object({
  password: contrasenaNueva,
  confirmation: z.string().min(1, 'Confirma la contraseña'),
}).refine((data) => data.password === data.confirmation, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmation'],
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

// Cambiar la contraseña con la sesión abierta: la nueva con la misma política
// que el restablecimiento; la actual, como en el acceso (puede ser anterior al
// endurecimiento), con el tope del servidor.
export const cambiarContrasenaSchema = z.object({
  actual: contrasenaExistente.max(128, 'Esa contraseña es demasiado larga'),
  nueva: contrasenaNueva,
  confirmacion: z.string().min(1, 'Repite la contraseña nueva'),
}).refine((data) => data.nueva === data.confirmacion, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmacion'],
})

export type CambiarContrasenaFormData = z.infer<typeof cambiarContrasenaSchema>

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email('Introduce un email válido'),
})

export type RequestPasswordResetFormData = z.infer<typeof requestPasswordResetSchema>
