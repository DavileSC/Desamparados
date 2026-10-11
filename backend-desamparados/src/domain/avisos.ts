import { Role } from '@prisma/client';

/**
 * Las reglas de los avisos de la junta, sueltas y sin base de datos para
 * probarlas solas.
 */

/** El Hermano Mayor y Administración lo llevan todo: pueden dar por hecho cualquier aviso. */
const LO_LLEVAN_TODO: Role[] = [Role.ADMIN, Role.HERMANO_MAYOR];

/**
 * ¿Puede este usuario dar el aviso por hecho? Quien lo recibe (su cargo, o
 * cualquiera si es para toda la junta), quien lo creó, el Hermano Mayor y
 * Administración.
 */
export function puedeDarPorHecho(
  aviso: { para: Role | null; creadoPorId: number | null },
  usuario: { id: number; role: string },
): boolean {
  if (LO_LLEVAN_TODO.includes(usuario.role as Role)) return true;
  if (aviso.para === null || aviso.para === usuario.role) return true;
  return aviso.creadoPorId !== null && aviso.creadoPorId === usuario.id;
}

/**
 * La fecha límite «AAAA-MM-DD» como medianoche UTC, que es como Prisma guarda
 * un `@db.Date`. Una fecha que no existe (31 de febrero) no vale.
 */
export function fechaLimite(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return null;
  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return fecha.toISOString().slice(0, 10) === texto ? fecha : null;
}
