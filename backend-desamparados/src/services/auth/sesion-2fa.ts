import { Prisma, Role } from '@prisma/client';
import db from '../../config/db';
import { HttpError } from '../../utils/error.handle';
import { generateToken } from '../../utils/jwt.handle';
import { limpiarFallos2FA, pasoTotpActual } from './codigos-2fa.js';

/**
 * El final del acceso al CMS, sea cual sea el segundo factor: el código de la
 * app, un código de respaldo, la aprobación desde un móvil apuntado o entrar
 * desde ese mismo móvil. Vive aparte para que los cuatro caminos gasten el
 * testigo del primer factor y emitan la sesión exactamente igual: un camino
 * que se saltara una comprobación sería la puerta trasera de los demás.
 */

/**
 * El testigo del primer factor ya se gastó (o es de antes de un segundo factor
 * aceptado): hay que volver a pasar por la contraseña.
 */
export class Testigo2FACaducadoError extends HttpError {
  readonly codigo = 'PENDING_2FA_REQUIRED';
  constructor() {
    super('La verificación ha caducado. Vuelve a introducir tu email y contraseña.', 401);
    this.name = 'Testigo2FACaducadoError';
    Object.setPrototypeOf(this, Testigo2FACaducadoError.prototype);
  }
}

/**
 * Lo que trae el testigo: `paso2fa` es el `twoFactorLastStep` de la cuenta
 * cuando se emitió (si ya no coincide, desde entonces se ha aceptado otro
 * segundo factor y no vale) y `emitidoMs`, cuándo (si es anterior a
 * `tokenValidAfter`, entre medias se cambió la contraseña o se cerraron todas
 * las sesiones).
 */
export interface DatosDelTestigo {
  paso2fa?: number | null;
  emitidoMs?: number;
}

/** Los perfiles que acompañan a la sesión: los mismos que en el login sin 2FA. */
export const PERFILES_DE_LA_SESION = {
  where: { activo: true },
  select: { id: true, nombre: true, esTitular: true, puesto: true },
} as const;

/**
 * Testigo de un solo uso. Se eligió atarlo a `twoFactorLastStep` en vez de
 * apuntar su `jti` en memoria: vale igual con varias instancias o tras un
 * reinicio, y no hay nada que barrer. El precio es que dos logins a medias de
 * la misma cuenta se pisan: el segundo en llegar repite la contraseña.
 *
 * Y atado a la cuenta tal como estaba al acertar la contraseña: si desde
 * entonces se ha desactivado, se ha cambiado la contraseña o se han cerrado
 * todas sus sesiones, los cinco minutos del testigo no pueden saltárselo.
 * Sin `emitidoMs` (testigos de antes de existir el claim) tampoco vale.
 */
export function comprobarTestigo(
  user: { active: boolean; tokenValidAfter: Date; twoFactorLastStep: number | null },
  testigo: DatosDelTestigo,
): void {
  if (testigo.paso2fa === undefined || user.twoFactorLastStep !== testigo.paso2fa) {
    throw new Testigo2FACaducadoError();
  }
  if (!user.active || typeof testigo.emitidoMs !== 'number' || testigo.emitidoMs < user.tokenValidAfter.getTime()) {
    throw new Testigo2FACaducadoError();
  }
}

/**
 * Gasta el testigo sin gastar un intervalo TOTP (un respaldo, una aprobación):
 * avanza `twoFactorLastStep` a mano, condicionado al valor leído. Si no, el
 * testigo seguiría vivo y admitiría otro segundo factor. Devuelve si ganó.
 */
export async function avanzarPasoDelTestigo(
  tx: Prisma.TransactionClient,
  user: { id: number; twoFactorLastStep: number | null },
): Promise<boolean> {
  const { count } = await tx.user.updateMany({
    where: { id: user.id, twoFactorLastStep: user.twoFactorLastStep },
    data: { twoFactorLastStep: Math.max(pasoTotpActual(), (user.twoFactorLastStep ?? -1) + 1) },
  });
  return count === 1;
}

/**
 * Lo que se hace al pasar el segundo factor por cualquier camino: limpiar los
 * fallos y anular las aprobaciones que quedaran esperando. El testigo al que
 * estaban atadas ya no vale, y un móvil que aprobara después enseñaría
 * «Entrada aprobada» para una entrada que no va a ocurrir.
 */
export async function alPasarSegundoFactor(userId: number): Promise<void> {
  limpiarFallos2FA(userId);
  await db.aprobacionEntrada.updateMany({
    where: { userId, estado: { in: ['PENDIENTE', 'APROBADA'] } },
    data: { estado: 'CADUCADA' },
  });
}

/** Lo que la sesión necesita de la cuenta, venga de la consulta que venga. */
interface CuentaDeLaSesion {
  id: number;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  hermanos: { id: number; nombre: string; esTitular: boolean; puesto: string | null }[];
}

/** La sesión del segundo factor, con el mismo `user` que el login sin 2FA. */
export function sesionDe(
  user: CuentaDeLaSesion,
  recordarme: boolean,
  origen: 'cms' | 'hermanos',
  extra: { backupCodesRemaining?: number } = {},
) {
  return {
    status: 'OK' as const,
    token: generateToken(user.id, user.role, recordarme, origen),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      perfiles: user.hermanos,
      twoFactorEnabled: user.twoFactorEnabled,
      origen,
      ...extra,
    },
  };
}

/**
 * El segundo factor sin código: una aprobación desde el móvil o entrar desde
 * el móvil apuntado. `gastar` es lo propio de cada camino (marcar usada la
 * aprobación, apuntar el uso del móvil) y va en la misma transacción que el
 * testigo: si cualquiera de los dos pierde, no se gasta nada.
 */
export async function pasarSinCodigo(
  userId: number,
  recordarme: boolean,
  origen: 'cms' | 'hermanos',
  testigo: DatosDelTestigo,
  gastar: (tx: Prisma.TransactionClient) => Promise<boolean>,
) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { hermanos: PERFILES_DE_LA_SESION } });
  if (!user || !user.twoFactorEnabled) throw new Testigo2FACaducadoError();
  comprobarTestigo(user, testigo);

  await db.$transaction(async (tx) => {
    if (!(await avanzarPasoDelTestigo(tx, user))) throw new Testigo2FACaducadoError();
    if (!(await gastar(tx))) throw new Testigo2FACaducadoError();
  });

  await alPasarSegundoFactor(user.id);
  return sesionDe(user, recordarme, origen);
}
