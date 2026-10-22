// AUD-005: suprimir la cuenta (RGPD, art. 17) borra también lo que guardan de
// ella los contadores de la entrada, las redes confiadas y los rebotes: su
// correo en claro y las IP desde las que entraba. Y lo caducado se borra con
// reloj, no solo cuando se juntan cien fallos.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Role } from '@prisma/client';
import db from '../src/config/db.js';
import { MisDatosService } from '../src/services/mis-datos.service.js';
import { barrerCaducados } from '../src/utils/contador-fallos.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await db.$disconnect();
});

const fallo = (contador: string, clave: string, haceMs = 0) => {
  const cuando = new Date(Date.now() - haceMs);
  return db.falloDeAcceso.create({ data: { contador, clave, fallos: 1, tandas: 0, ultimoFallo: cuando, bloqueadoHasta: cuando } });
};

test('suprimir la cuenta borra su correo e IP de los contadores, las redes confiadas y los rebotes', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const creada = await crearUsuarioPrueba(Role.USER);
  // Con «_», que en un LIKE vale por cualquier letra: la de otra cuenta que
  // solo cambia en esa letra no se puede ir con ella.
  const [local, dominio] = creada.email.toLowerCase().split('@');
  const email = `${local}_x@${dominio}`;
  const parecidaDeVerdad = `${local}ax@${dominio}`;
  const cuenta = await db.user.update({ where: { id: creada.id }, data: { email } });
  try {
    await fallo('login-por-email', email);
    await fallo('login-por-ip', `${email}|203.0.113.7`);
    await fallo('doble-factor', String(cuenta.id));
    await fallo('login-por-ip', `${parecidaDeVerdad}|203.0.113.8`);
    await db.redConfiada.create({ data: { clave: `${email}|203.0.113.7`, vistaEn: new Date() } });
    await db.correoQueRebota.create({ data: { email, motivo: 'REBOTE' } });

    await MisDatosService.deleteOwnAccount(cuenta.id, PASSWORD_PRUEBA, 'hermanos');

    assert.equal(await db.falloDeAcceso.count({ where: { OR: [{ clave: email }, { clave: `${email}|203.0.113.7` }, { contador: 'doble-factor', clave: String(cuenta.id) }] } }), 0);
    assert.equal(await db.redConfiada.count({ where: { clave: `${email}|203.0.113.7` } }), 0);
    assert.equal(await db.correoQueRebota.count({ where: { email } }), 0);
    assert.equal(await db.falloDeAcceso.count({ where: { clave: `${parecidaDeVerdad}|203.0.113.8` } }), 1, 'el de otra cuenta se queda: el «_» no es un comodín');
  } finally {
    await db.falloDeAcceso.deleteMany({ where: { clave: { in: [email, `${email}|203.0.113.7`, `${parecidaDeVerdad}|203.0.113.8`] } } });
    await db.redConfiada.deleteMany({ where: { clave: `${email}|203.0.113.7` } });
    await db.correoQueRebota.deleteMany({ where: { email } });
    await borrarUsuarioPrueba(cuenta.id);
  }
});

test('lo caducado se borra con reloj; un bloqueo vivo y lo reciente se quedan', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const marca = `barrido-${Date.now()}`;
  const DIA = 24 * 3600 * 1000;
  try {
    await fallo('login-por-email', `${marca}-viejo@prueba.es`, 3 * DIA);
    await fallo('login-por-email', `${marca}-reciente@prueba.es`, 3600_000);
    const vivo = new Date(Date.now() + 3600_000);
    await db.falloDeAcceso.create({ data: { contador: 'doble-factor', clave: `${marca}-vivo`, fallos: 0, tandas: 3, ultimoFallo: new Date(Date.now() - 3 * DIA), bloqueadoHasta: vivo } });
    await db.redConfiada.create({ data: { clave: `${marca}-vieja|203.0.113.1`, vistaEn: new Date(Date.now() - 31 * DIA) } });
    await db.redConfiada.create({ data: { clave: `${marca}-nueva|203.0.113.1`, vistaEn: new Date() } });

    await barrerCaducados();

    const quedan = (await db.falloDeAcceso.findMany({ where: { clave: { startsWith: marca } }, select: { clave: true } })).map((f) => f.clave).sort();
    assert.deepEqual(quedan, [`${marca}-reciente@prueba.es`, `${marca}-vivo`]);
    const redes = (await db.redConfiada.findMany({ where: { clave: { startsWith: marca } }, select: { clave: true } })).map((r) => r.clave);
    assert.deepEqual(redes, [`${marca}-nueva|203.0.113.1`]);
  } finally {
    await db.falloDeAcceso.deleteMany({ where: { clave: { startsWith: marca } } });
    await db.redConfiada.deleteMany({ where: { clave: { startsWith: marca } } });
  }
});
