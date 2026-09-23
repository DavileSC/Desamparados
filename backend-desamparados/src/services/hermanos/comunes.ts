/**
 * Lo que comparten las tres puertas del censo: la del hermano con sus fichas,
 * la de Secretaría con todo el censo y la cola de solicitudes.
 *
 * Aquí están las reglas que no son de ninguna en particular: qué campos se
 * pueden editar y cuáles no (la lista blanca que impide que nadie se ascienda
 * a ADMIN escribiendo en su ficha), qué se le puede enseñar al staff sin sacar
 * datos bancarios, cómo se reintenta una transacción que choca con otra, y la
 * emancipación, que hacen igual el tutor y Secretaría.
 */
import db from '../../config/db';
import { encrypt } from '../../utils/bcrypt.handle';
import { Prisma, Role } from '@prisma/client';
import { CreateHermanoDto, UpdateHermanoDto, EmancipateHermanoDto, UpdateAdminHermanoDto } from '../../dtos/hermano.dto';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service';
import { HttpError, NotFoundError } from '../../utils/error.handle';
import { comprobarBajaNoFutura, comprobarEsAdulto, comprobarEsMenor, comprobarFechasHermano, comprobarMayoriaDeEdad, diaDeHoy, instanteDeDia, mismoDia } from '../../domain/fechas-hermano';
import { esCuentaAnonimizada } from '../../domain/cuenta-anonimizada';
import { diferenciasFicha, valorParaAuditoria } from '../../domain/cambios-ficha';
import crypto from 'crypto';
import { AuthService } from '../auth.service';
import { EmailService } from '../email.service';
import { condicionBusqueda } from '../../domain/busqueda-texto.js';
import { sanearPaginacion, respuestaPaginada } from '../../domain/paginacion.js';
import { ORDENES_CENSO, ordenDe } from '../../domain/ordenacion.js';
import { esConflictoTransitorio } from '../../utils/transaction-retry.js';

// 1. DICCIONARIO DE ERRORES (Centralizado)
export const HERMANO_ERRORS = {
  DNI_DUPLICATE: 'Ese DNI ya está registrado.',
  MANAGER_NOT_FOUND: 'Usuario gestor no encontrado.',
  NOT_AUTHORIZED: 'Perfil no encontrado o no autorizado.',
  DNI_REQUIRED_EMANCIPATION: 'El hermano necesita DNI para tener cuenta propia.',
  EMAIL_IN_USE: 'El email ya está en uso.',
  USER_NOT_FOUND: 'Usuario no encontrado.',
  ALREADY_ACTIVE: 'Este usuario ya está activo en el sistema.',
  NOTHING_TO_APPROVE: 'Este usuario no tiene perfiles pendientes de aprobación.',
  CANNOT_DELETE_ACTIVE: 'No puedes destruir la cuenta de un hermano activo.',
  CANNOT_TOUCH_STAFF: 'Esta cuenta pertenece a un miembro del staff: gestiona su rol desde Administración.',
  PENDING_PROFILE: 'Este perfil aún no ha sido aprobado por Secretaría.',
  HERMANO_NOT_FOUND: 'Hermano no encontrado.',
  HERMANO_ALREADY_ACTIVE: 'El hermano ya está activo.',
  HERMANO_ALREADY_DOWN: 'Este hermano ya está dado de baja.',
  PROFILE_ALREADY_DOWN: 'Este perfil ya está dado de baja.',
  PENDING_USE_REQUESTS: 'Esta ficha es una solicitud de alta pendiente: se aprueba o se rechaza desde Solicitudes.',
  BAJA_ONLY_WHEN_DOWN: 'La fecha de baja solo se corrige en fichas que ya están de baja. Para dar de baja a un hermano, usa «Dar de baja».',
  NUMBER_ONLY_ACTIVE: 'El número de hermano solo se cambia en fichas activas: a las demás se lo asignan «Aprobar» o «Reactivar».',
  NUMBER_DUPLICATE: 'Ese número de hermano ya lo tiene otra ficha.',
  FICHA_CHANGED: 'La ficha ha cambiado mientras la editabas (alguien la ha dado de baja o reactivado). Vuelve a cargarla y repite el cambio.'
} as const;

// 2. INTERFAZ PARA EL BUSCADOR
export interface SearchHermanoQuery {
  q?: string;
  tunica?: string;
  puesto?: string;
  activo?: string;
  tieneTunicaPropia?: string;
  /** Situación de la ficha, como la lee el listado del CMS. */
  estado?: 'activo' | 'baja' | 'pendiente';
  /** Con número de hermano o todavía sin él. */
  numero?: 'con' | 'sin';
  orden?: string;
  page?: string;
  limit?: string;
}

/**
 * Las tres situaciones de una ficha. «De baja» y «pendiente» comparten
 * `activo: false`; las separa la fecha de baja, que solo pone una baja.
 */
export const WHERE_SITUACION: Record<NonNullable<SearchHermanoQuery['estado']>, Prisma.HermanoWhereInput> = {
  activo: { activo: true },
  baja: { activo: false, fechaBaja: { not: null } },
  pendiente: { activo: false, fechaBaja: null },
};

// 3. LISTAS BLANCAS DE CAMPOS EDITABLES (anti mass-assignment)
// El objeto que llega a Prisma se construye SOLO con estas claves. Nunca `{...body}`:
// Prisma acepta escrituras anidadas (user.update, recibos.updateMany...) y con el body
// crudo cualquier hermano podía ascenderse a ADMIN o marcar sus recibos como pagados.
//
// `apellidos` no está: lo compone el servidor desde los dos sueltos
// (domain/apellidos.ts). Los datos bancarios sí: el hermano cambia su cuenta él
// mismo. El parentesco, solo en las fichas a cargo (lo mira updateProfileIfOwned).
export const USER_EDITABLE_FIELDS = [
  'nombre', 'primerApellido', 'segundoApellido', 'fechaNacimiento', 'dni',
  'sexo', 'estadoCivil', 'profesion', 'lugarNacimiento',
  'telefono', 'telefonoFijo', 'email', 'email2',
  'direccion', 'poblacion', 'codigoPostal', 'provincia', 'comunidadAutonoma', 'pais', 'boletin',
  'fechaBautismo', 'lugarBautismo', 'parroquiaBautismo',
  'formaPagoPref', 'iban', 'titularCuenta', 'titularidadCuenta',
  'parentesco'
] as const;

// Sin `activo`: la edición genérica de la ficha no da altas ni bajas. Esas van
// por aprobarSolicitud, reactivarHermano y darDeBajaHermano, que asignan o
// liberan el número, tocan la cuenta y dejan rastro en la auditoría.
// `fechaBaja` sigue aquí solo para CORREGIR la fecha de una ficha que ya está
// de baja (lo comprueba updateAdminMode).
//
// Los datos bancarios no: el censo no los enseña (ver HERMANO_SAFE_SELECT) y
// tampoco los escribe. Los cambia el propio hermano, desde su área.
const CAMPOS_BANCARIOS = ['formaPagoPref', 'iban', 'titularCuenta', 'titularidadCuenta'] as const;
type CampoBancario = typeof CAMPOS_BANCARIOS[number];
const sinBancarios = USER_EDITABLE_FIELDS.filter(
  (campo): campo is Exclude<typeof USER_EDITABLE_FIELDS[number], CampoBancario> => !(CAMPOS_BANCARIOS as readonly string[]).includes(campo)
);

export const ADMIN_EDITABLE_FIELDS = [
  ...sinBancarios,
  'tieneTunicaPropia', 'tunica', 'alturaHombro', 'puesto',
  'esTitular', 'numeroHermano',
  'fechaAlta', 'fechaBaja',
  // La jura y quién lo presentó los lleva Secretaría: el hermano los ve y no los toca.
  'fechaJura', 'presentadoPor', 'presentadoPor2'
] as const;

export type EditableField = typeof ADMIN_EDITABLE_FIELDS[number] | typeof USER_EDITABLE_FIELDS[number];

// Campos de la ficha que se pueden mostrar al staff sin exponer datos bancarios
export const HERMANO_SAFE_SELECT = {
  id: true, nombre: true, apellidos: true, dni: true, fechaNacimiento: true,
  telefono: true, email: true, direccion: true, poblacion: true, codigoPostal: true,
  fechaAlta: true, activo: true, numeroHermano: true, fechaBaja: true, motivoBaja: true, esTitular: true,
  // Quién es para el titular: «Mi familia» lo enseña, porque una ficha a cargo
  // de alguien que no es su padre se gestiona distinto (autorización aparte).
  parentesco: true,
  tieneTunicaPropia: true, tunica: true, alturaHombro: true, puesto: true,
  // El resto de la ficha, sin los datos bancarios.
  primerApellido: true, segundoApellido: true, sexo: true, estadoCivil: true,
  profesion: true, lugarNacimiento: true, telefonoFijo: true, email2: true,
  provincia: true, comunidadAutonoma: true, pais: true, boletin: true,
  fechaBautismo: true, lugarBautismo: true, parroquiaBautismo: true,
  // Los documentos del alta: solo el nombre, se descargan con sesión del CMS.
  foto: true, certificadoBautismo: true,
  fechaJura: true, presentadoPor: true, presentadoPor2: true
} satisfies Prisma.HermanoSelect;

/** Una ficha pendiente de aprobación: nunca activa y sin baja. */
export const FICHA_PENDIENTE = { activo: false, fechaBaja: null } satisfies Prisma.HermanoWhereInput;

/** Solo las cuentas de hermano raso (USER) se bloquean/borran al perder sus fichas. */
export const esCuentaStaff = (role: Role) => role !== Role.USER;

export const CAMPOS_FECHA = ['fechaNacimiento', 'fechaAlta', 'fechaBaja', 'fechaBautismo', 'fechaJura'] as const;

/**
 * Quita de los cambios las fechas que caen en el mismo día (de Madrid) que ya
 * tiene la ficha. El formulario manda el día, no la hora: reescribir un alta
 * aprobada a las 00:30 con el comienzo de su día no cambia nada visible, pero
 * sí el dato, y con el día UTC la movía al día anterior sin que nadie la tocara.
 */
export function sinFechasDelMismoDia(cambios: Record<string, unknown>, actual: Record<string, unknown>): Record<string, unknown> {
  const limpios = { ...cambios };
  for (const campo of CAMPOS_FECHA) {
    const nuevo = limpios[campo];
    if (nuevo instanceof Date && mismoDia(nuevo, actual[campo] as Date | null)) delete limpios[campo];
  }
  return limpios;
}

// --- Reintento ante choques entre peticiones simultáneas ---
// El número de hermano se calcula como «el mayor + 1» sin bloquear la tabla. Dos
// aprobaciones a la vez leen el mismo máximo y la segunda en escribir choca con
// el índice único (P2002); si InnoDB detecta un interbloqueo, el error es P2034.
//
// Además, MariaDB 11.8 trae `innodb_snapshot_isolation=ON`: si una transacción
// intenta escribir una fila que otra cambió después de su primera lectura (dos
// clics seguidos en «Aprobar», «Dar de baja» o «Reactivar»), falla con el error
// 1020 («Record has changed since last read»), que Prisma no traduce a P2034 (la
// forma en que llega depende de la versión: la reconoce `esConflictoTransitorio`).
// Sin esto, un doble clic era un 500.
//
// En todos esos casos basta con repetir la transacción entera: la nueva lectura
// ya ve lo que hizo la otra (el número que se llevó, o que la ficha ya no está
// pendiente). Pocos intentos y con algo de azar en la espera, para que dos
// peticiones no reintenten al compás.
const INTENTOS_TRANSACCION = 4;

// P2002 solo es reintentable aquí, por el número de hermano: en general un
// duplicado es un error del usuario, no un choque transitorio.
function esChoqueReintentable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return true;
  return esConflictoTransitorio(e);
}

// `opciones` se reenvía tal cual a `db.$transaction` (mismo tipo que acepta
// Prisma: `timeout`, `maxWait`, `isolationLevel`). Casi nadie lo necesita —
// una transacción de una o dos fichas cabe de sobra en los 5 s por defecto—,
// pero quien procesa un lote (`cerrarHuecosDeNumero`) sí, y sin margen un
// timeout no es de los errores que reintenta `esChoqueReintentable`: Prisma
// deshace todo y no hay nada que reintentar, el lote es el mismo.
export async function transaccionReintentable<T>(
  operacion: (tx: Prisma.TransactionClient) => Promise<T>,
  opciones?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
): Promise<T> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await db.$transaction(operacion, opciones);
    } catch (e) {
      if (!esChoqueReintentable(e) || intento >= INTENTOS_TRANSACCION) throw e;
      await new Promise((resolver) => setTimeout(resolver, 20 * intento + Math.floor(Math.random() * 30)));
    }
  }
}

/** La ficha con lo que necesita la emancipación, venga del tutor o de secretaría. */
export type FichaEmancipable = {
  id: number; userId: number; nombre: string; apellidos: string | null; telefono: string | null;
  direccion: string | null; dni: string | null; email: string | null; activo: boolean;
  esTitular: boolean; fechaNacimiento: Date | null; user: { role: Role };
};

/** DNI único entre las fichas: mejor un 409 con mensaje que el P2002 crudo. */
export async function comprobarDniLibre(dni: string, exceptoId: number, cliente: Prisma.TransactionClient | typeof db = db) {
  // Dentro de una transacción se consulta con ella; fuera, con el cliente normal.
  const otro = await (cliente as Prisma.TransactionClient).hermano.findFirst({ where: { dni, id: { not: exceptoId } }, select: { id: true } });
  if (otro) throw new HttpError(HERMANO_ERRORS.DNI_DUPLICATE, 409);
}

/**
 * Construye el objeto de update por LISTA BLANCA.
 * Solo pasan las claves permitidas para el rol; el resto del body se ignora aunque
 * ArkType las hubiera dejado pasar. Nunca se reenvía el objeto entero a Prisma.
 */
export function prepareUpdateData(
  data: UpdateAdminHermanoDto,
  allowedFields: readonly EditableField[]
): Prisma.HermanoUpdateInput {
  const source = data as Record<string, unknown>;
  const cleanedData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    const value = source[field];
    if (value === undefined) continue;
    // Solo valores primitivos: un objeto aquí sería un intento de escritura anidada
    if (value !== null && typeof value === 'object') continue;
    cleanedData[field] = value;
  }

  // Del día escrito al instante que se guarda (ver instanteDeDia): el alta y la
  // baja, comienzo del día en Madrid; el nacimiento, medianoche UTC.
  for (const campo of CAMPOS_FECHA) {
    const valor = cleanedData[campo];
    if (typeof valor !== 'string') continue;
    cleanedData[campo] = instanteDeDia(valor, campo);
  }

  return cleanedData as Prisma.HermanoUpdateInput;
}

/**
 * Siguiente número libre: el mayor asignado + 1.
 *
 * POLÍTICA DEL GRUPO PARROQUIAL (no es un descuido): no hay contador propio.
 * Como la baja libera el número (darDeBajaHermano) y aquí se toma el máximo,
 * si causa baja quien tiene el número más alto, el siguiente que entre hereda
 * ese número; los huecos de en medio no se rellenan hasta la reordenación
 * anual del censo. Cambiarlo es decisión de Secretaría, no de código.
 *
 * Sin bloqueo: dos altas simultáneas pueden leer el mismo máximo. Quien llama
 * lo hace dentro de `transaccionReintentable`, que repite ante el choque.
 */
export async function getNextNumeroHermano(tx: Prisma.TransactionClient) {
  const ultimo = await tx.hermano.findFirst({
    where: { numeroHermano: { not: null } },
    orderBy: { numeroHermano: 'desc' },
    select: { numeroHermano: true }
  });
  return (ultimo?.numeroHermano || 0) + 1;
}

export async function emanciparFicha(
  hermano: FichaEmancipable,
  newEmail: string,
  newDni: string | undefined,
  hashedPassword: string,
  mandarEnlace: boolean,
  meta?: MetaDeAuditoria
) {
  const hermanoId = hermano.id;
  const managerUserId = hermano.userId;

  // Una ficha pendiente de aprobación no puede convertirse en una cuenta activa
  if (!hermano.activo) throw new HttpError(HERMANO_ERRORS.PENDING_PROFILE);

  // Cuenta propia solo con 18 años cumplidos. Sin esta regla se podía dar
  // cuenta a un niño, y el tutor perdía la suya si era su último perfil activo.
  comprobarMayoriaDeEdad(hermano.fechaNacimiento);

  const dniFinal = hermano.dni || newDni;
  if (!dniFinal) throw new HttpError(HERMANO_ERRORS.DNI_REQUIRED_EMANCIPATION);

  const emailExists = await db.user.findUnique({ where: { email: newEmail } });
  if (emailExists) throw new HttpError(HERMANO_ERRORS.EMAIL_IN_USE, 409);

  // El DNI también es único en User: si ya pertenece a otra cuenta (ej. el propio tutor),
  // la transacción fallaría con un error crudo de BD. Lo comprobamos antes.
  const dniExists = await db.user.findFirst({ where: { dni: dniFinal } });
  if (dniExists) throw new HttpError('Ese DNI ya pertenece a otra cuenta de usuario.', 409);

  const { cuenta, tutorDesactivado } = await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: newEmail,
        password: hashedPassword,
        role: Role.USER,
        dni: dniFinal,
        nombre: hermano.nombre,
        apellidos: hermano.apellidos || '',
        telefono: hermano.telefono || '',
        direccion: hermano.direccion || '',
        active: true
      }
    });

    await tx.hermano.update({
      where: { id: hermanoId },
      data: { userId: newUser.id, esTitular: true, email: newEmail, dni: dniFinal }
    });

    // --- Control del Gestor Fantasma ---
    const restantes = await tx.hermano.count({
      where: { userId: managerUserId, activo: true }
    });

    let desactivado = false;
    if (restantes === 0 && !esCuentaStaff(hermano.user.role)) {
      await tx.user.update({
        where: { id: managerUserId },
        data: { active: false }
      });
      desactivado = true;
    }
    // ------------------------------------------

    // Devolvemos solo datos seguros (nunca el hash de la contraseña)
    return { cuenta: { id: newUser.id, email: newUser.email, nombre: newUser.nombre }, tutorDesactivado: desactivado };
  });

  // Auditoría DESPUÉS de confirmar: creación de una cuenta nueva derivada de un
  // perfil familiar. Antes se escribía dentro de la transacción y quedaba
  // constancia aunque esta se deshiciera.
  await AuditoriaService.log(ACCIONES_AUDITORIA.EMANCIPACION, meta ?? {}, 'hermano', hermanoId, {
    origen: mandarEnlace ? 'secretaría' : 'tutor',
    antes: { userId: managerUserId, esTitular: hermano.esTitular, email: hermano.email, dni: hermano.dni, cuentaTutorActiva: true },
    despues: { userId: cuenta.id, esTitular: true, email: newEmail, dni: dniFinal, cuentaTutorActiva: !tutorDesactivado }
  });

  if (mandarEnlace) {
    // Fuera de la transacción y con catch, como en requestPasswordReset: que
    // falle el correo no puede deshacer una emancipación ya escrita.
    const token = await AuthService.crearEnlaceDeContrasena(cuenta.id, 72);
    EmailService.enviarRecuperacionContrasena(cuenta.email, cuenta.nombre, token)
      .catch(err => console.error('Error enviando el enlace de emancipación:', err));
  }

  return cuenta;
}
