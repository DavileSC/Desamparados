import { Role } from '@prisma/client';
import db from '../../src/config/db.js';
import { encrypt } from '../../src/utils/bcrypt.handle.js';

export const PASSWORD_PRUEBA = 'Prueba-2026-Segura';

let contador = 0;

/**
 * Crea un usuario desechable. El email y el DNI llevan un sufijo único para no
 * chocar con datos reales ni entre ejecuciones.
 *
 * Las cuentas del equipo nacen con el doble factor activado, porque sin él el
 * CMS solo deja activarlo (ver checkRole). No llevan secreto: las pruebas que
 * entran con un código de verdad, o que lo activan, piden `dobleFactor: false`
 * y lo montan ellas.
 */
export async function crearUsuarioPrueba(role: Role = Role.USER, { dobleFactor = role !== Role.USER } = {}) {
  contador += 1;
  // Con el pid: los ficheros de test corren en procesos paralelos, cada uno con
  // su propio `contador`, y dos que coincidían en el mismo milisegundo chocaban
  // con el índice único del email y cancelaban un fichero entero.
  const sufijo = `${Date.now()}${process.pid}${contador}`;

  return db.user.create({
    data: {
      email: `prueba-${sufijo}@ejemplo.test`,
      password: await encrypt(PASSWORD_PRUEBA),
      dni: `T${sufijo}`,
      nombre: 'Prueba',
      apellidos: 'Automatica',
      telefono: '600000000',
      role,
      twoFactorEnabled: dobleFactor,
      // Un minuto en el pasado: el `iat` del JWT va en segundos enteros y, si el
      // login cae en el mismo segundo que la creación, el redondeo lo dejaría
      // antes de tokenValidAfter y la sesión nacería ya invalidada. Los cortes
      // por área tienen el mismo problema, agravado porque el reloj de MariaDB
      // y el de Node no son el mismo: si nacieran con `now()` de la base, un
      // token emitido con el reloj de Node podría quedar justo antes.
      tokenValidAfter: new Date(Date.now() - 60_000),
      cmsValidoDesde: new Date(Date.now() - 60_000),
      hermanoValidoDesde: new Date(Date.now() - 60_000)
    }
  });
}

export async function borrarUsuarioPrueba(id: number) {
  await db.user.deleteMany({ where: { id } });
}
