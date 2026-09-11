import { diaMadrid } from './contabilidad';

/**
 * Qué cambió en una ficha, en el formato que guarda la auditoría
 * (`AuditLog.detalles = { antes, despues }`).
 *
 * Solo entran los campos que cambian de verdad: el formulario del CMS manda la
 * ficha entera en cada guardado y un registro con veinte campos «iguales»
 * esconde el único que importa.
 */

export type ValorAuditado = string | number | boolean | null;
export type Instantanea = Record<string, ValorAuditado>;
export type DetallesCambio = { antes: Instantanea; despues: Instantanea };

/**
 * Datos bancarios: nunca en claro en la auditoría, que la lee más gente de la
 * que puede ver una cuenta. Se anota que cambió y nada más.
 */
const CAMPOS_BANCARIOS = new Set(['iban', 'titularCuenta']);
export const MARCA_CAMBIADO = 'cambiado';

/**
 * Convierte un valor a algo que se pueda comparar y guardar en JSON. Las fechas
 * de la ficha son de día (alta, baja, nacimiento): se guardan como 'AAAA-MM-DD'
 * del día de MADRID, para que un alta de las 10:00 y la misma fecha escrita a
 * mano no cuenten como un cambio. Con el día UTC, un alta de las 00:30 de
 * Málaga y su día anterior salían «iguales» y el cambio no quedaba registrado.
 */
export function valorParaAuditoria(valor: unknown): ValorAuditado {
  if (valor === undefined || valor === null) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : diaMadrid(valor);
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  return String(valor);
}

/**
 * Compara la ficha tal como estaba con los cambios que se van a escribir y
 * devuelve solo lo que difiere, o `null` si no cambia nada (no hay nada que
 * registrar).
 */
export function diferenciasFicha(
  antes: Record<string, unknown>,
  cambios: Record<string, unknown>,
): DetallesCambio | null {
  const detalles: DetallesCambio = { antes: {}, despues: {} };

  for (const [campo, nuevo] of Object.entries(cambios)) {
    if (nuevo === undefined) continue;
    const valorAntes = valorParaAuditoria(antes[campo]);
    const valorDespues = valorParaAuditoria(nuevo);
    if (valorAntes === valorDespues) continue;

    if (CAMPOS_BANCARIOS.has(campo)) {
      detalles.despues[campo] = MARCA_CAMBIADO;
      continue;
    }
    detalles.antes[campo] = valorAntes;
    detalles.despues[campo] = valorDespues;
  }

  return Object.keys(detalles.despues).length > 0 ? detalles : null;
}
