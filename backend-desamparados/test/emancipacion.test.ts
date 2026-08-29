// El camino de staff de la emancipación: secretaría crea la cuenta del hermano
// y el sistema le manda un enlace para que ponga su contraseña. Secretaría no
// la elige ni la conoce.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import db from '../src/config/db.js';
import { HermanoService } from '../src/services/hermano.service.js';

let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

// Ids creados en las pruebas, para dejar la base como estaba.
const creados: { usuarios: number[]; hermanos: number[] } = { usuarios: [], hermanos: [] };

before(async () => {
  try { await db.$queryRaw`SELECT 1`; dbDisponible = true; } catch { dbDisponible = false; }
});

after(async () => {
  if (!dbDisponible) return;
  await db.hermano.deleteMany({ where: { id: { in: creados.hermanos } } });
  await db.user.deleteMany({ where: { id: { in: creados.usuarios } } });
  await db.$disconnect();
});

/** Un tutor con un menor a su cargo, listo para emanciparlo. */
async function tutorConDependiente(sufijo: string) {
  const tutor = await db.user.create({
    data: {
      email: `tutor.${sufijo}@ejemplo.invalido`, password: 'no-importa', dni: `9000000${sufijo}Z`,
      nombre: 'Tutor', apellidos: 'De Prueba', telefono: '600000001',
    },
  });
  const dependiente = await db.hermano.create({
    data: {
      userId: tutor.id, nombre: 'Menor', apellidos: 'De Prueba', dni: `9100000${sufijo}Z`,
      fechaNacimiento: new Date('2006-05-15'), activo: true, esTitular: false,
    },
  });
  creados.usuarios.push(tutor.id);
  creados.hermanos.push(dependiente.id);
  return { tutor, dependiente };
}

describe('emancipación desde secretaría', () => {
  test('la cuenta nueva nace sin contraseña con la que se pueda entrar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente } = await tutorConDependiente('1');

    const resultado = await HermanoService.emancipateByStaff(dependiente.id, { newEmail: 'emancipado.1@ejemplo.invalido' });
    creados.usuarios.push(resultado.id);

    // El cliente omite el token del reset en toda consulta (config/db.ts): aquí
    // hay que pedirlo a propósito, que es justo lo que se quiere comprobar.
    const cuenta = await db.user.findUnique({ where: { id: resultado.id }, omit: { resetPasswordToken: false, resetPasswordExpires: false } });
    assert.ok(cuenta);
    // Nadie eligió esa contraseña, así que nadie la sabe: lo que vale es el enlace.
    assert.ok(cuenta!.resetPasswordToken, 'la cuenta debería tener un enlace pendiente');
  });

  test('el enlace vale tres días, no una hora', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente } = await tutorConDependiente('2');

    const resultado = await HermanoService.emancipateByStaff(dependiente.id, { newEmail: 'emancipado.2@ejemplo.invalido' });
    creados.usuarios.push(resultado.id);

    const cuenta = await db.user.findUnique({ where: { id: resultado.id }, omit: { resetPasswordToken: false, resetPasswordExpires: false } });
    const horas = (cuenta!.resetPasswordExpires!.getTime() - Date.now()) / 3600000;
    // Quien se emancipa no está delante de la pantalla cuando secretaría pulsa.
    assert.ok(horas > 71 && horas <= 72, `el enlace caduca en ${horas} horas`);
  });

  test('la ficha pasa a la cuenta nueva y queda como titular', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente } = await tutorConDependiente('3');

    const resultado = await HermanoService.emancipateByStaff(dependiente.id, { newEmail: 'emancipado.3@ejemplo.invalido' });
    creados.usuarios.push(resultado.id);

    const ficha = await db.hermano.findUnique({ where: { id: dependiente.id } });
    assert.equal(ficha!.userId, resultado.id);
    assert.equal(ficha!.esTitular, true);
  });

  test('un correo que ya usa otra cuenta se rechaza y no deja nada a medias', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente, tutor } = await tutorConDependiente('4');

    await assert.rejects(
      () => HermanoService.emancipateByStaff(dependiente.id, { newEmail: tutor.email }),
      /correo|email/i,
    );

    const ficha = await db.hermano.findUnique({ where: { id: dependiente.id } });
    assert.equal(ficha!.userId, tutor.id, 'la ficha no debería haberse movido');
  });

  test('al quedarse sin nadie a cargo, la cuenta del tutor se desactiva', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente, tutor } = await tutorConDependiente('5');

    const resultado = await HermanoService.emancipateByStaff(dependiente.id, { newEmail: 'emancipado.5@ejemplo.invalido' });
    creados.usuarios.push(resultado.id);

    const cuentaTutor = await db.user.findUnique({ where: { id: tutor.id } });
    assert.equal(cuentaTutor!.active, false);
  });
});
