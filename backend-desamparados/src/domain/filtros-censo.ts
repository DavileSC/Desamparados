import type { Prisma } from '@prisma/client';

/** Los filtros del censo que no son búsqueda ni situación: los que hacen útil una lista guardada. */
interface FiltrosAvanzados {
  correo?: 'con' | 'sin' | 'rebota';
  cuenta?: 'con' | 'sin';
  edad?: 'menores' | 'adultos';
  medalla?: 'con' | 'sin';
  boletin?: 'si';
}

const vacio = (campo: 'email' | 'iban'): Prisma.HermanoWhereInput => ({ OR: [{ [campo]: null }, { [campo]: '' }] });

/**
 * Las condiciones de esos filtros, para juntarlas con `AND` a las demás.
 *
 * «Con correo» cuenta también al titular sin correo en la ficha: su cuenta
 * del área tiene el suyo por fuerza. Quien no tiene ni uno ni otro es a quien
 * hay que escribirle por correo postal. La edad se mide a `hoy`: menor es
 * quien nació hace menos de 18 años.
 *
 * «Que rebota» busca la dirección que usa cada ficha entre las que el servicio
 * de envío dio por perdidas (`rebotan`): la suya o, sin ella, la de su cuenta.
 */
export function filtrosAvanzados(f: FiltrosAvanzados, hoy: Date, rebotan: string[] = []): Prisma.HermanoWhereInput[] {
  const condiciones: Prisma.HermanoWhereInput[] = [];
  if (f.correo === 'con') condiciones.push({ OR: [{ NOT: vacio('email') }, { esTitular: true }] });
  if (f.correo === 'sin') condiciones.push(vacio('email'), { esTitular: false });
  if (f.correo === 'rebota') condiciones.push({ OR: [{ email: { in: rebotan } }, { AND: [vacio('email'), { user: { email: { in: rebotan } } }] }] });
  if (f.cuenta === 'con') condiciones.push({ NOT: vacio('iban') });
  if (f.cuenta === 'sin') condiciones.push(vacio('iban'));
  if (f.edad) {
    const mayoriaDeEdad = new Date(Date.UTC(hoy.getUTCFullYear() - 18, hoy.getUTCMonth(), hoy.getUTCDate()));
    condiciones.push({ fechaNacimiento: f.edad === 'menores' ? { gt: mayoriaDeEdad } : { lte: mayoriaDeEdad } });
  }
  if (f.medalla) condiciones.push({ fechaMedalla: f.medalla === 'con' ? { not: null } : null });
  if (f.boletin === 'si') condiciones.push({ boletin: true });
  return condiciones;
}
