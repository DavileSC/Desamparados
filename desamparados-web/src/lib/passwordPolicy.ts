import { z } from 'zod'
// Se importa el módulo del backend en vez de copiarlo. Es TypeScript puro, sin
// una sola dependencia, así que el bundler lo incluye sin problema.
//
// Duplicar estas reglas sería peor: son la política de contraseñas, y una copia
// acaba divergiendo del original sin que nadie se entere. Si el backend endurece
// la lista negra o sube el mínimo, el formulario lo hereda el mismo día.
//
// El backend sigue siendo la autoridad: esto solo sirve para avisar mientras se
// escribe, en lugar de dejar que el servidor rechace el envío con un error seco.
import {
  motivoContrasenaDebil,
  LONGITUD_MINIMA,
  LONGITUD_MAXIMA,
} from '../../../backend-desamparados/src/domain/password-debil'

export { LONGITUD_MINIMA, LONGITUD_MAXIMA }

/**
 * Contraseña NUEVA: registro y restablecimiento. Aplica la política completa y
 * devuelve el motivo concreto, porque un «contraseña no válida» a secas solo
 * consigue que la persona lo intente otras cinco veces.
 */
export const contrasenaNueva = z.string().superRefine((valor, ctx) => {
  const motivo = motivoContrasenaDebil(valor)
  if (motivo) {
    ctx.addIssue({ code: 'custom', message: `La contraseña ${motivo}` })
  }
})

/**
 * Contraseña EXISTENTE: solo el acceso. Aquí no se aplica la política a
 * propósito. Quien se registró antes de que subiera el mínimo tiene una
 * contraseña más corta que sigue siendo válida, y exigirle 12 caracteres en el
 * formulario lo dejaría fuera de su propia cuenta sin explicación.
 */
export const contrasenaExistente = z.string().min(1, 'Introduce tu contraseña')
