import { z } from 'zod'
import { contrasenaNueva } from '../../../lib/politicaDeContrasena'
import {
  esDniValido, esTelefonoValido, esCodigoPostalValido, esTextoValido, esIbanValido,
} from '../../../lib/validacion/identidad'

/**
 * Las mismas reglas que aplica el servidor (`lib/validacion/identidad.ts`).
 * Antes eran más flojas y el alta se caía con un 400 que no decía qué campo
 * fallaba: el navegador daba por bueno lo que el servidor rechazaba.
 */
const textoLibre = (etiqueta: string) =>
  z.string().refine(esTextoValido, `${etiqueta} es obligatorio y no puede llevar < ni >`)

/** Un texto que puede ir vacío (el segundo apellido), pero sin < ni >. */
const textoOpcional = (etiqueta: string) =>
  z.string().refine((valor) => !/[<>]/.test(valor), `${etiqueta} no puede llevar < ni >`)

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
  primerApellido: textoLibre('El primer apellido'),
  segundoApellido: textoOpcional('El segundo apellido'),
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

export const SEXOS = ['HOMBRE', 'MUJER'] as const
export const ESTADOS_CIVILES = ['SOLTERO', 'CASADO', 'PAREJA_DE_HECHO', 'SEPARADO', 'DIVORCIADO', 'VIUDO'] as const
/** La cuota es anual: se domicilia o se paga en Secretaría. */
export const FORMAS_DE_PAGO_ALTA = ['DOMICILIACION', 'EFECTIVO'] as const
/** Quién es el titular de la cuenta, visto desde quien rellena el alta. */
export const TITULARIDADES = ['PROPIA', 'FAMILIAR_HERMANO', 'OTRA_PERSONA'] as const

/**
 * Los dos documentos que se adjuntan. Las mismas reglas que el servidor
 * (`alta-documentos.middleware.ts`): allí se miran además por su contenido.
 */
export const DOCUMENTOS_ALTA = {
  foto: { extensiones: ['.jpg', '.jpeg', '.png'], megas: 5, tipos: 'JPG o PNG' },
  certificadoBautismo: { extensiones: ['.pdf', '.doc', '.docx'], megas: 10, tipos: 'PDF, DOC o DOCX' },
} as const

const documento = (cual: keyof typeof DOCUMENTOS_ALTA, nombre: string) => {
  const reglas = DOCUMENTOS_ALTA[cual]
  return z.custom<File | null>((valor) => valor === null || valor instanceof File)
    .refine(
      (fichero) => !fichero || (reglas.extensiones as readonly string[]).some((ext) => fichero.name.toLowerCase().endsWith(ext)),
      `${nombre} tiene que ser ${reglas.tipos}`,
    )
    .refine((fichero) => !fichero || fichero.size <= reglas.megas * 1024 * 1024, `${nombre} pesa más de ${reglas.megas} MB`)
}

export const menorVacio: MenorFormData = {
  nombre: '', primerApellido: '', segundoApellido: '', parentesco: 'HIJO', fechaNacimiento: '', dni: '', email: '',
}

/**
 * El formulario entero. Los campos están siempre presentes y es `superRefine`
 * quien decide cuáles hacen falta según el camino: así el formulario conserva
 * lo escrito si se vuelve atrás y se cambia de idea.
 */
export const membershipSchema = z.object({
  camino: z.enum(CAMINOS),
  nombre: textoLibre('El nombre'),
  primerApellido: textoLibre('El primer apellido'),
  segundoApellido: textoOpcional('El segundo apellido'),
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
  // Sexo, estado civil y bautismo son de la ficha propia: `superRefine` los
  // exige solo cuando el adulto se hace hermano. '' es «sin elegir».
  sexo: z.enum(SEXOS).or(z.literal('')),
  estadoCivil: z.enum(ESTADOS_CIVILES).or(z.literal('')),
  fechaBautismo: z.string(),
  lugarBautismo: textoOpcional('El lugar de bautismo'),
  parroquiaBautismo: textoOpcional('La parroquia'),
  provincia: textoOpcional('La provincia'),
  comunidadAutonoma: textoOpcional('La comunidad autónoma'),
  pais: textoOpcional('El país'),
  formaPago: z.enum(FORMAS_DE_PAGO_ALTA).or(z.literal('')),
  iban: z.string(),
  titularidad: z.enum(TITULARIDADES),
  titularCuenta: textoOpcional('El titular'),
  foto: documento('foto', 'La foto'),
  certificadoBautismo: documento('certificadoBautismo', 'El certificado'),
  boletin: z.boolean(),
  menores: z.array(menorSchema),
  // Campo trampa: escondido en el formulario. Sin validación ninguna —una
  // persona nunca lo ve, así que no hay nada que corregirle— y opcional,
  // para que una web antigua en caché durante un despliegue siga enviando.
  comentarioAdicional: z.string().optional(),
  aceptarPolitica: z.boolean().refine((value) => value === true, {
    message: 'Debes aceptar la política de privacidad',
  }),
}).superRefine((datos, ctx) => {
  if (!datos.formaPago) {
    ctx.addIssue({ code: 'custom', path: ['formaPago'], message: 'Elige cómo vas a pagar la cuota' })
  }
  if (datos.formaPago === 'DOMICILIACION') {
    if (!datos.iban.trim()) {
      ctx.addIssue({ code: 'custom', path: ['iban'], message: 'Para domiciliar la cuota hace falta el IBAN' })
    } else if (!esIbanValido(datos.iban)) {
      ctx.addIssue({ code: 'custom', path: ['iban'], message: 'Revisa el IBAN: los dígitos de control no cuadran' })
    }
    if (datos.titularidad !== 'PROPIA' && !datos.titularCuenta.trim()) {
      ctx.addIssue({ code: 'custom', path: ['titularCuenta'], message: 'Escribe el nombre del titular de la cuenta' })
    }
  }

  if (conFichaPropia(datos.camino)) {
    if (!datos.sexo) ctx.addIssue({ code: 'custom', path: ['sexo'], message: 'Elige una opción' })
    if (!datos.estadoCivil) ctx.addIssue({ code: 'custom', path: ['estadoCivil'], message: 'Elige una opción' })
    const hoy = new Date().toISOString().slice(0, 10)
    if (!datos.fechaBautismo) {
      ctx.addIssue({ code: 'custom', path: ['fechaBautismo'], message: 'La fecha de bautismo es obligatoria' })
    } else if (datos.fechaBautismo > hoy || (datos.fechaNacimiento && datos.fechaBautismo < datos.fechaNacimiento)) {
      ctx.addIssue({ code: 'custom', path: ['fechaBautismo'], message: 'No puede ser anterior al nacimiento ni posterior a hoy' })
    }
  }

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
