import { z } from 'zod'
import { contrasenaNueva } from '../../../lib/politicaDeContrasena'
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

/**
 * Los tres caminos del alta. Lo primero que se pregunta, porque ordena todo lo
 * demás: qué campos se piden y en qué pasos.
 */
export const CAMINOS = ['HERMANO', 'HERMANO_Y_MENORES', 'SOLO_MENORES'] as const
export type Camino = (typeof CAMINOS)[number]

/** Si el camino trae menores a cargo, hay un paso más para apuntarlos. */
export const conMenores = (camino: Camino) => camino !== 'HERMANO'
/** Y si el adulto se hace hermano, hace falta su fecha de nacimiento (tendrá ficha). */
export const conFichaPropia = (camino: Camino) => camino !== 'SOLO_MENORES'

export const MAXIMO_MENORES = 8

/** Años cumplidos a día de hoy. La misma cuenta que hace el servidor. */
export function aniosCumplidos(fechaNacimiento: string, hoy = new Date()): number {
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`)
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad -= 1
  return edad
}

export const MAYORIA_DE_EDAD = 18

/**
 * Un menor a cargo. El DNI y el correo son opcionales a propósito: un niño de
 * siete años no tiene ninguno de los dos, pero uno de quince suele tener los
 * dos, y obligar a dejarlos vacíos lo dejaría fuera.
 */
const menorSchema = z.object({
  nombre: textoLibre('El nombre'),
  apellidos: textoLibre('Los apellidos'),
  parentesco: z.enum(['HIJO', 'SOBRINO', 'NIETO', 'AHIJADO', 'OTRO']),
  fechaNacimiento: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
  // '' es «no tiene»: el cliente de la API no manda los campos vacíos.
  dni: z.string().refine((valor) => valor === '' || esDniValido(valor), 'Revisa el DNI o NIE: la letra no corresponde con el número'),
  email: z.string().refine(
    (valor) => valor === '' || z.string().email().safeParse(valor.trim()).success,
    'Introduce un email válido o déjalo en blanco',
  ),
})

export type MenorFormData = z.infer<typeof menorSchema>

export const menorVacio: MenorFormData = {
  nombre: '', apellidos: '', parentesco: 'HIJO', fechaNacimiento: '', dni: '', email: '',
}

/**
 * El formulario entero. Los campos están siempre presentes y es `superRefine`
 * quien decide cuáles hacen falta según el camino: así el formulario conserva
 * lo escrito si se vuelve atrás y se cambia de idea.
 */
export const membershipSchema = z.object({
  camino: z.enum(CAMINOS),
  nombre: textoLibre('El nombre'),
  apellidos: textoLibre('Los apellidos'),
  email: z.string().trim().email('Introduce un email válido').max(254, 'El email es demasiado largo'),
  password: contrasenaNueva,
  // El DNI se pide siempre: es de la cuenta, no de la ficha, y quien solo
  // apunta a un menor también abre cuenta.
  dni: z.string().refine(esDniValido, 'Revisa el DNI o NIE: la letra no corresponde con el número'),
  telefono: z.string().refine(esTelefonoValido, 'El teléfono son nueve dígitos'),
  direccion: textoLibre('La dirección'),
  ciudad: textoLibre('La ciudad'),
  codigoPostal: z.string().refine(esCodigoPostalValido, 'El código postal son cinco dígitos'),
  fechaNacimiento: z.string(),
  menores: z.array(menorSchema),
  aceptarPolitica: z.boolean().refine((value) => value === true, {
    message: 'Debes aceptar la política de privacidad',
  }),
}).superRefine((datos, ctx) => {
  if (conFichaPropia(datos.camino)) {
    if (!datos.fechaNacimiento) {
      ctx.addIssue({ code: 'custom', path: ['fechaNacimiento'], message: 'La fecha de nacimiento es obligatoria' })
    } else if (aniosCumplidos(datos.fechaNacimiento) < MAYORIA_DE_EDAD) {
      // Se dice aquí lo mismo que diría el servidor, y además se apunta la salida:
      // un menor no abre cuenta, pero puede apuntarlo un adulto.
      ctx.addIssue({
        code: 'custom',
        path: ['fechaNacimiento'],
        message: `Para hacerte hermano por tu cuenta hacen falta ${MAYORIA_DE_EDAD} años. Si eres menor, vuelve atrás: tiene que apuntarte un adulto.`,
      })
    }
  }

  if (!conMenores(datos.camino)) return

  if (datos.menores.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['menores'], message: 'Añade al menos un menor' })
  }

  datos.menores.forEach((menor, i) => {
    if (menor.fechaNacimiento && aniosCumplidos(menor.fechaNacimiento) >= MAYORIA_DE_EDAD) {
      ctx.addIssue({
        code: 'custom',
        path: ['menores', i, 'fechaNacimiento'],
        message: `Ya tiene ${MAYORIA_DE_EDAD} años cumplidos: con esa edad el alta la hace la propia persona, con su DNI.`,
      })
    }
  })

  // Dos fichas con el mismo DNI chocarían en el servidor; se dice antes y se
  // señala cuál de las dos hay que corregir.
  const dnis = datos.menores.map((menor) => menor.dni.trim().toUpperCase()).filter(Boolean)
  datos.menores.forEach((menor, i) => {
    const suyo = menor.dni.trim().toUpperCase()
    if (suyo && dnis.indexOf(suyo) !== i) {
      ctx.addIssue({ code: 'custom', path: ['menores', i, 'dni'], message: 'Este DNI ya está en otro de los menores' })
    }
    if (suyo && suyo === datos.dni.trim().toUpperCase()) {
      ctx.addIssue({ code: 'custom', path: ['menores', i, 'dni'], message: 'Ese es tu propio DNI' })
    }
  })
})

export type MembershipFormData = z.infer<typeof membershipSchema>
