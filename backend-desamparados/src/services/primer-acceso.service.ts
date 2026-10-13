/**
 * El primer acceso de los hermanos que entraron con el censo importado.
 *
 * El importador les da cuenta con una contraseña que nadie sabe y la marca
 * `primerAccesoPendiente`. Secretaría les manda una invitación por correo; el
 * enlace pone la contraseña y abre la sesión, y la web no deja usar el área
 * hasta que el hermano revisa su ficha y las de quien cuelga de su cuenta y
 * las confirma. Confirmar quita la marca para siempre.
 *
 * Las invitaciones salen como los comunicados: en segundo plano, de una en
 * una y con pausa, porque Gmail corta a quien manda cuatrocientas de golpe.
 * La cola vive en memoria: si el servidor se reinicia a medias, las que no
 * salieron siguen «sin invitar» y Secretaría las vuelve a mandar.
 */
import { Prisma, Role } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { generateToken } from '../utils/jwt.handle.js';
import { respuestaPaginada, sanearPaginacion } from '../domain/paginacion.js';
import { enUnaFrase, faltanEnLaFicha } from '../domain/ficha-obligatoria.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service.js';
import { AreaHermanosApagadaError, AuthService } from './auth.service.js';
import { cuentaDeCustodia } from './censo-hoja.service.js';
import { EmailService } from './email.service.js';
import { ModulosService } from './modulos.service.js';

/** Dos semanas: es un correo que mucha gente abre días después. */
const VALIDEZ_INVITACION_HORAS = 14 * 24;

/**
 * En qué está la invitación de una cuenta con el primer acceso pendiente, para
 * que Secretaría sepa a quién reenviarla:
 *
 * - `sin-invitar`: no le ha salido ninguna (o la primera no llegó a salir).
 * - `vigente` / `caducada`: el enlace del correo vale hasta `caducaEn`, o
 *   dejó de valer entonces sin que lo usara.
 * - `sustituida`: el enlace ya no vale porque pidió otro para recuperar la
 *   contraseña (comparten el campo del token) y aún no lo ha usado.
 * - `estrenada`: ya puso su contraseña; falta que confirme la ficha.
 *
 * Null si ya confirmó: no hay invitación de la que hablar.
 *
 * Una invitación viva manda sobre «ya entró»: si Secretaría reenvía a quien ya
 * entró, lo que importa es que ese enlace vale. La vigencia no se deduce del
 * token, que también lo deja una recuperación, sino de `invitacionCaducaEn`,
 * que solo escribe la invitación y borra todo lo que gasta o pisa su token.
 */
export type EstadoInvitacion = 'sin-invitar' | 'vigente' | 'caducada' | 'sustituida' | 'estrenada';

export function situacionDeLaInvitacion(
  c: { primerAccesoPendiente: boolean; invitadoEn: Date | null; invitacionCaducaEn: Date | null; contrasenaPuestaEn: Date | null },
  ahora = new Date(),
): { estado: EstadoInvitacion; caducaEn: string | null } | null {
  if (!c.primerAccesoPendiente) return null;
  // Con `invitadoEn` vacío el correo no llegó a salir, aunque su token exista.
  if (c.invitadoEn && c.invitacionCaducaEn) {
    return { estado: c.invitacionCaducaEn > ahora ? 'vigente' : 'caducada', caducaEn: c.invitacionCaducaEn.toISOString() };
  }
  if (c.contrasenaPuestaEn) return { estado: 'estrenada', caducaEn: null };
  return { estado: c.invitadoEn ? 'sustituida' : 'sin-invitar', caducaEn: null };
}

/** La misma pausa que los comunicados, que es la que Gmail aguanta sin cortar. */
const pausa = () => Number(process.env.COMUNICADOS_PAUSA_MS ?? 1500);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ENLACE_NO_VALIDO = 'El enlace de la invitación no es válido o ha caducado. Pide otro a la Secretaría o entra con «¿Has olvidado tu contraseña?».';

type EstadoPrimerAcceso = 'sin-invitar' | 'invitado' | 'confirmado';

/**
 * Las cuentas del primer acceso: las que lo tienen pendiente y las que ya lo
 * hicieron. Quien ya puso su contraseña sin invitación (entró por «¿Has
 * olvidado tu contraseña?», que el censo trae su correo) cuenta con los
 * invitados: «Invitar a los que faltan» no tiene que mandarle nada.
 */
function condicion(estado?: EstadoPrimerAcceso): Prisma.UserWhereInput {
  if (estado === 'confirmado') return { active: true, fichaConfirmadaEn: { not: null } };
  if (estado === 'invitado') return { active: true, primerAccesoPendiente: true, OR: [{ invitadoEn: { not: null } }, { contrasenaPuestaEn: { not: null } }] };
  if (estado === 'sin-invitar') return { active: true, primerAccesoPendiente: true, invitadoEn: null, contrasenaPuestaEn: null };
  return { active: true, OR: [{ primerAccesoPendiente: true }, { fichaConfirmadaEn: { not: null } }] };
}

// --- La cola de invitaciones -----------------------------------------------

const cola = new Set<number>();
let enMarcha: Promise<void> | null = null;

async function invitarUna(userId: number): Promise<void> {
  // Puede haber confirmado o haberse dado de baja mientras esperaba en la cola.
  const cuenta = await db.user.findFirst({
    where: { id: userId, active: true, primerAccesoPendiente: true },
    select: { email: true, nombre: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } },
  });
  if (!cuenta) return;
  const { token, datos } = AuthService.enlaceSinGuardar(VALIDEZ_INVITACION_HORAS, { invitacion: true });
  const ok = await EmailService.enviarInvitacionPrimerAcceso(cuenta.email, cuenta.nombre, token, {
    horas: VALIDEZ_INVITACION_HORAS, sexo: cuenta.hermanos[0]?.sexo ?? undefined,
  });
  // El enlace se guarda solo si el correo ha salido, y de una vez con la
  // fecha de la invitación. Si no sale, todo queda como estaba: «sin
  // invitar», o la invitación anterior con su enlace, que sigue valiendo y
  // es lo que el CMS dice; el fallo queda en la auditoría y Secretaría la
  // reenvía. El envío es síncrono (se espera la respuesta del SMTP), así que
  // `ok` es de verdad «salió». Queda un instante entre que sale y se guarda:
  // quien abriera el correo justo entonces vería «enlace no válido», y si la
  // escritura fallara, el correo llevaría un enlace que no vale; en los dos
  // casos el CMS sigue diciendo la verdad y basta con reenviarla.
  if (ok) await db.user.update({ where: { id: userId }, data: { ...datos, invitadoEn: new Date() } });
}

/** Manda lo que haya en la cola, de una en una. Solo hay uno en marcha a la vez. */
function procesarCola(): Promise<void> {
  enMarcha ??= (async () => {
    try {
      for (;;) {
        const siguiente = cola.values().next();
        if (siguiente.done) break;
        try {
          await invitarUna(siguiente.value);
        } finally {
          cola.delete(siguiente.value);
        }
        if (cola.size > 0 && pausa() > 0) await esperar(pausa());
      }
    } catch (error) {
      // Un fallo de la base no debe tumbar el servidor; lo que quede se manda
      // en la próxima invitación.
      console.error('❌ [Primer acceso] Las invitaciones se han detenido:', error);
    } finally {
      enMarcha = null;
    }
  })();
  return enMarcha;
}

/**
 * La etiqueta de un campo dicha en la frase del 409. La del parentesco es una
 * pregunta del formulario («Qué es para ti»), que en «Faltan datos en la
 * ficha de Lucía: qué es para ti» no se entiende. Se cambia aquí y no en
 * `shared/ficha-obligatoria.json`, que es lo que pinta la web junto al campo.
 */
const enLaFrase = (c: { campo: string; etiqueta: string }) => (c.campo === 'parentesco' ? { ...c, etiqueta: 'el parentesco' } : c);

export class PrimerAccesoService {
  // --- CMS --------------------------------------------------------------------

  /** Las cuentas del primer acceso, con las cifras de cada estado y lo que queda en la cola. */
  static async listar(query: { estado?: EstadoPrimerAcceso; q?: string; page?: string; limit?: string }) {
    const paginacion = sanearPaginacion(query);
    const texto = query.q?.trim();
    const where: Prisma.UserWhereInput = {
      AND: [
        condicion(query.estado),
        ...(texto ? [{ OR: [{ nombre: { contains: texto } }, { apellidos: { contains: texto } }, { email: { contains: texto } }] }] : []),
      ],
    };
    const [cuentas, total, sinInvitar, invitados, confirmados] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, nombre: true, apellidos: true, email: true, invitadoEn: true, fichaConfirmadaEn: true,
          primerAccesoPendiente: true, invitacionCaducaEn: true, contrasenaPuestaEn: true,
          hermanos: { where: { activo: true }, select: { esTitular: true, numeroHermano: true } },
        },
        orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }, { id: 'asc' }],
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.user.count({ where }),
      db.user.count({ where: condicion('sin-invitar') }),
      db.user.count({ where: condicion('invitado') }),
      db.user.count({ where: condicion('confirmado') }),
    ]);
    const data = cuentas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellidos: c.apellidos,
      email: c.email,
      numeroHermano: c.hermanos.find((h) => h.esTitular)?.numeroHermano ?? null,
      aCargo: c.hermanos.filter((h) => !h.esTitular).length,
      invitadoEn: c.invitadoEn,
      fichaConfirmadaEn: c.fichaConfirmadaEn,
      invitacion: situacionDeLaInvitacion(c),
      enCola: cola.has(c.id),
    }));
    return { ...respuestaPaginada(data, total, paginacion), cifras: { sinInvitar, invitados, confirmados, enCola: cola.size } };
  }

  /**
   * Pone en la cola las invitaciones: las de esas cuentas (reenviar) o, sin
   * ninguna, las de todas las que faltan por invitar. Responde en el acto con
   * cuántas van; los correos salen después.
   */
  static async invitar(ids: number[] | undefined, meta: MetaDeAuditoria) {
    if (!(await ModulosService.activo('area-hermanos'))) throw new AreaHermanosApagadaError();
    const cuentas = await db.user.findMany({
      where: ids ? { id: { in: ids }, active: true, primerAccesoPendiente: true } : condicion('sin-invitar'),
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (cuentas.length === 0) {
      throw new HttpError(ids ? 'Esas cuentas ya han confirmado su ficha o están de baja.' : 'No queda nadie por invitar.', 409);
    }
    for (const { id } of cuentas) cola.add(id);
    await AuditoriaService.log(ACCIONES_AUDITORIA.PRIMER_ACCESO_INVITAR, meta, 'primer-acceso', undefined, {
      cuentas: cuentas.length, reenvio: ids !== undefined,
    });
    void procesarCola();
    return { encoladas: cuentas.length };
  }

  /** Para las pruebas: esperar a que la cola se vacíe. */
  static async esperarCola(): Promise<void> {
    await enMarcha;
  }

  // --- La invitación (sin sesión) --------------------------------------------

  /** A quién es la invitación, para saludarle antes de pedirle la contraseña. No gasta el enlace. */
  static async datosDeLaInvitacion(token: string) {
    if (!(await ModulosService.activo('area-hermanos'))) throw new AreaHermanosApagadaError();
    const cuenta = await AuthService.cuentaDelEnlace(token);
    if (!cuenta) throw new HttpError(ENLACE_NO_VALIDO, 400);
    return { nombre: cuenta.nombre, email: cuenta.email };
  }

  /**
   * Pone la contraseña y devuelve la sesión del área de hermanos de esa
   * cuenta: quien abre el enlace de su correo ya ha probado que es suya, y
   * mandarle a escribirla otra vez en el acceso sería un paso de más.
   */
  static async estrenar(token: string, contrasena: string, recordarme: boolean) {
    if (!(await ModulosService.activo('area-hermanos'))) throw new AreaHermanosApagadaError();
    const cuenta = await AuthService.cuentaDelEnlace(token);
    if (!cuenta) throw new HttpError(ENLACE_NO_VALIDO, 400);
    // Gasta el enlace en una sola sentencia (dos pestañas no lo usan las dos),
    // corta las sesiones de antes y quita los bloqueos de la entrada.
    const { corte } = await AuthService.resetPassword(token, contrasena);
    // Como en `cambiarContrasena`: el corte va 1 ms por delante, y con una base
    // rápida la sesión salía con `emitidoMs` anterior a él. La web decía
    // «dentro» y la siguiente petición respondía 401.
    while (Date.now() < corte.getTime()) await new Promise((r) => setTimeout(r, 1));
    return { userId: cuenta.id, role: cuenta.role, token: generateToken(cuenta.id, cuenta.role, recordarme, 'hermanos') };
  }

  // --- El hermano ---------------------------------------------------------------

  /**
   * Da la ficha por revisada. Ninguna se confirma con un obligatorio vacío
   * (los del alta, más qué es para el titular cada ficha que cuelga de su
   * cuenta, que el censo de antes no traía): el importador deja en blanco lo
   * que el Excel no tenía, y confirmar es justo lo que lo arregla.
   */
  static async confirmar(userId: number, meta: MetaDeAuditoria) {
    const cuenta = await db.user.findUnique({
      where: { id: userId },
      select: {
        primerAccesoPendiente: true,
        hermanos: {
          where: { activo: true },
          select: {
            id: true, esTitular: true, nombre: true, apellidos: true, primerApellido: true, dni: true, fechaNacimiento: true,
            sexo: true, estadoCivil: true, fechaBautismo: true, email: true, telefono: true, direccion: true,
            codigoPostal: true, poblacion: true, parentesco: true,
            formaPagoPref: true, iban: true, titularidadCuenta: true, titularCuenta: true,
          },
        },
      },
    });
    if (!cuenta) throw new NotFoundError('Cuenta no encontrada.');
    // Dos pestañas, o volver atrás: ya estaba hecho y el resultado es el mismo.
    if (!cuenta.primerAccesoPendiente) return { confirmada: true };
    const conCuotas = await ModulosService.activo('cuotas-en-linea');
    for (const ficha of cuenta.hermanos) {
      const faltan = faltanEnLaFicha(ficha, conCuotas);
      if (faltan.length === 0) continue;
      const de = ficha.esTitular ? 'tu ficha' : `la ficha de ${ficha.nombre}`;
      throw new HttpError(`Faltan datos obligatorios en ${de}: ${enUnaFrase(faltan.map(enLaFrase))}.`, 409, {
        fichaIncompleta: { id: ficha.id, nombre: ficha.nombre, esTitular: ficha.esTitular, campos: faltan.map((c) => c.campo) },
      });
    }

    await db.user.update({ where: { id: userId }, data: { primerAccesoPendiente: false, fichaConfirmadaEn: new Date() } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PRIMER_ACCESO_CONFIRMAR, meta, 'user', userId, { fichas: cuenta.hermanos.length });
    return { confirmada: true };
  }

  /**
   * «No es de mi familia»: el censo apuntaba esa ficha con el correo del
   * titular por error. Vuelve a la cuenta de custodia y Secretaría recibe un
   * aviso en el Inicio del CMS para averiguar de quién es. Solo durante el
   * primer acceso: después, la familia se gestiona desde «Mi familia».
   */
  static async fichaAjena(userId: number, hermanoId: number, meta: MetaDeAuditoria) {
    const ficha = await db.hermano.findFirst({
      where: { id: hermanoId, userId, esTitular: false, user: { primerAccesoPendiente: true } },
      select: { nombre: true, apellidos: true, numeroHermano: true, user: { select: { nombre: true, apellidos: true } } },
    });
    if (!ficha) throw new NotFoundError('Esa ficha no está en tu cuenta.');

    const quien = `${ficha.nombre} ${ficha.apellidos}`.trim();
    const titular = `${ficha.user.nombre} ${ficha.user.apellidos}`.trim();
    const texto = `${ficha.numeroHermano ? `N.º ${ficha.numeroHermano}, ` : ''}${quien}: ${titular} dice que no es de su familia. Ha vuelto al censo importado.`;
    await db.$transaction(async (tx) => {
      const custodia = await cuentaDeCustodia(tx);
      await tx.hermano.update({ where: { id: hermanoId }, data: { userId: custodia, parentesco: null } });
      await tx.avisoJunta.create({
        // El aviso admite 160 caracteres: con nombres muy largos se recorta.
        data: { texto: texto.length > 160 ? `${texto.slice(0, 159)}…` : texto, para: Role.SECRETARIA, hermanoId, creadoPorId: userId, creadorRol: Role.USER },
      });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PRIMER_ACCESO_FICHA_AJENA, meta, 'hermano', hermanoId);
    return { devuelta: true };
  }
}
