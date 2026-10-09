import db from '../../src/config/db.js';
import { ModulosService } from '../../src/services/modulos.service.js';
import type { ClaveModulo } from '../../src/domain/modulos.js';

/**
 * Enciende estos módulos en la base y devuelve cómo dejarlos como estaban.
 *
 * En el CI la base es nueva y la siembra los enciende todos; en local es la de
 * desarrollo, y lo que se haya apagado desde Sistema → «Módulos» sigue
 * apagado. Una prueba que necesite un módulo lo enciende ella: si no, en local
 * fallaba con un 404 (módulo apagado) sin que nada estuviera roto.
 *
 * Va directo a la base, sin `ModulosService.cambiar`, para no dejar apuntes
 * de auditoría ni comprobar requisitos: quien llama pasa también los que hagan
 * falta (`apadrinamientos` necesita `pago-en-linea`).
 */
export async function encenderModulos(claves: ClaveModulo[]): Promise<() => Promise<void>> {
  await ModulosService.sembrar();
  const antes = await db.modulo.findMany({ where: { clave: { in: claves } }, select: { clave: true, activo: true } });
  await db.modulo.updateMany({ where: { clave: { in: claves } }, data: { activo: true } });
  ModulosService.olvidar();
  return async () => {
    for (const fila of antes) await db.modulo.update({ where: { clave: fila.clave }, data: { activo: fila.activo } });
    ModulosService.olvidar();
  };
}
