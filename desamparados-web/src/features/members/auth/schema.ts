import { z } from 'zod'
import { contrasenaNueva, contrasenaExistente } from '../../../lib/passwordPolicy'

// El acceso NO aplica la política: quien tenga una contraseña anterior al
// endurecimiento del mínimo seguiría siendo válida, y rechazarla aquí lo dejaría
// fuera de su cuenta. La comprobación de verdad la hace el backend.
export const loginSchema = z.object({
  email: z.string().trim().email('Introduce un email válido'),
  password: contrasenaExistente,
})

export type LoginFormData = z.infer<typeof loginSchema>

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

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email('Introduce un email válido'),
})

export type RequestPasswordResetFormData = z.infer<typeof requestPasswordResetSchema>
