/**
 * Enmascarado de datos personales en los registros.
 *
 * Los logs escribían la dirección completa de cada hermano cada vez que se le
 * enviaba un correo. Nadie ha decidido cuánto se conservan esos ficheros ni
 * quién los lee, así que el principio de minimización del RGPD pide no
 * meterlos ahí: para diagnosticar un envío basta con reconocer de quién se
 * trata, no con poder escribirle.
 */

/** `hermano@ejemplo.org` → `he•••@ejemplo.org`. */
export function enmascararEmail(email: string): string {
  const arroba = email.lastIndexOf('@');
  if (arroba <= 0) return '•••';

  const usuario = email.slice(0, arroba);
  const dominio = email.slice(arroba);
  const visible = usuario.slice(0, Math.min(2, usuario.length));

  return `${visible}•••${dominio}`;
}
