import { z } from 'zod'

// Alineado con el backend: contraseña entre 8 y 64 caracteres
export const loginSchema = z.object({
  email: z.string().trim().email('Introduce un email válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(64, 'La contraseña no puede superar los 64 caracteres'),
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
