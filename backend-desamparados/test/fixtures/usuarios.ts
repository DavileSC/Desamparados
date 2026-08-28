import { Role } from '@prisma/client';
import db from '../../src/config/db.js';
import { encrypt } from '../../src/utils/bcrypt.handle.js';

export const PASSWORD_PRUEBA = 'Prueba-2026-Segura';

let contador = 0;

/**
 * Crea un usuario desechable. El email y el DNI llevan un sufijo único para no
 * chocar con datos reales ni entre ejecuciones.
 */
export async function crearUsuarioPrueba(role: Role = Role.USER) {
  contador += 1;
  const sufijo = `${Date.now()}${contador}`;

  return db.user.create({
    data: {
      email: `prueba-${sufijo}@ejemplo.test`,
      password: await encrypt(PASSWORD_PRUEBA),
      dni: `T${sufijo}`,
      nombre: 'Prueba',
      apellidos: 'Automatica',
      telefono: '600000000',
      role,
      // Un minuto en el pasado: el `iat` del JWT va en segundos enteros y, si el
      // login cae en el mismo segundo que la creación, el redondeo lo dejaría
      // antes de tokenValidAfter y la sesión nacería ya invalidada.
      tokenValidAfter: new Date(Date.now() - 60_000)
    }
  });
}

export async function borrarUsuarioPrueba(id: number) {
  await db.user.deleteMany({ where: { id } });
}
