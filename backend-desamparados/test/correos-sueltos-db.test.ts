// AUD-007: los correos que salen al momento (un alta, una contraseña, un
// justificante) cuentan para el tope diario de la cola. El servicio de envío
// tiene un tope para todos, y sin contarlos la cola se gastaba el cupo entero.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { enviarCorreo, ponerTransporte } from '../src/services/correos/envio.js';
import { enviadosHoy } from '../src/services/correos/cola.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  ponerTransporte(undefined);
  await db.$disconnect();
});

test('un correo suelto suma en los enviados de hoy; uno de la cola o uno que no sale, no', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  let falla = false;
  ponerTransporte({ sendMail: async () => { if (falla) throw new Error('caído'); return {}; } });

  const antes = await enviadosHoy();
  assert.equal(await enviarCorreo('suelto@prueba.es', 'Hola', '<p>hola</p>', { uso: 'prueba' }), true);
  assert.equal(await enviadosHoy(), antes + 1, 'el suelto cuenta');

  assert.equal(await enviarCorreo('cola@prueba.es', 'Hola', '<p>hola</p>', { uso: 'prueba', desdeLaCola: true }), true);
  assert.equal(await enviadosHoy(), antes + 1, 'el de la cola lo cuenta ella, no dos veces');

  falla = true;
  assert.equal(await enviarCorreo('suelto@prueba.es', 'Hola', '<p>hola</p>', { uso: 'prueba' }), false);
  assert.equal(await enviadosHoy(), antes + 1, 'lo que no sale no gasta cupo');
});
