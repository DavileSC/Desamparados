// test/alta-sin-delatar.test.ts
//
// El alta por la web no puede decir quién está en el censo. Antes, un DNI ya
// registrado respondía 409 «Ya hay una ficha en el censo con el DNI …»
// (antes de crear nada), y el formulario servía para averiguar si alguien es
// hermano probando DNI uno a uno: eso revela creencias (art. 9 RGPD). Ahora
// responde lo mismo que un alta hecha, no crea nada, escribe al correo del
// formulario sin decir qué dato chocó y deja el choque en la auditoría.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomInt } from 'node:crypto';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import type { CorreoParaBuzon } from '../src/utils/buzon-pruebas.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dniValido = (n: number) => `${String(n).padStart(8, '0')}${LETRAS[n % 23]}`;
const sufijo = `${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
let siguienteDni = 80_000_000 + randomInt(0, 900_000);
const nuevoDni = () => dniValido(siguienteDni++);
const correos: string[] = [];
const nuevoCorreo = (quien: string) => {
  const email = `${quien}-${sufijo}@ejemplo.test`;
  correos.push(email);
  return email;
};

let server: Server;
let baseUrl: string;
let dbDisponible = false;
const enviados: CorreoParaBuzon[] = [];
const titular = { fechaNacimiento: '1986-11-03', sexo: 'HOMBRE', estadoCivil: 'SOLTERO', fechaBautismo: '1986-12-28' };

const usuario = (email: string, dni: string) => ({
  email, dni, password: 'Trono-Alameda-84-Verde', nombre: 'Javier', apellidos: 'Ruiz Montes',
  telefono: '661223344', direccion: 'Calle Alameda 84', poblacion: 'Málaga', codigoPostal: '29013',
});

function alta(cuerpo: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comentarioAdicional: '', ...cuerpo }),
  });
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
  ponerTransporte({ sendMail: async (correo) => { enviados.push(correo); } });
});

after(async () => {
  ponerTransporte(undefined);
  server.close();
  if (dbDisponible) {
    const usuarios = await db.user.findMany({ where: { email: { in: correos } }, select: { id: true } });
    const ids = usuarios.map((u) => u.id);
    await db.hermano.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.auditLog.deleteMany({ where: { action: 'ALTA_NO_TRAMITADA', createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  }
  await db.$disconnect();
});

const esperarCorreos = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 25)); };

describe('un dato ya registrado no se delata', () => {
  test('DNI en el censo, DNI de un menor en el censo o correo de una cuenta: misma respuesta, nada creado', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const dniAdulto = nuevoDni();
    const dniMenor = nuevoDni();
    const primero = nuevoCorreo('primero');
    const buena = await alta({ usuario: usuario(primero, dniAdulto), titular, menores: [{ nombre: 'Marta', dni: dniMenor, fechaNacimiento: '2012-05-01' }] });
    assert.equal(buena.status, 201);
    const cuerpoBueno = await buena.json() as Record<string, unknown>;
    assert.deepEqual(Object.keys(cuerpoBueno).sort(), ['fichas', 'message'], 'sin el id de la cuenta, que delataría la diferencia');

    const intentos = {
      'el DNI del adulto ya es de una cuenta y una ficha': { usuario: usuario(nuevoCorreo('otro-adulto'), dniAdulto), titular, menores: [{ nombre: 'Luis', fechaNacimiento: '2013-01-01' }] },
      'el DNI de un menor ya tiene ficha': { usuario: usuario(nuevoCorreo('otro-menor'), nuevoDni()), titular, menores: [{ nombre: 'Otra', dni: dniMenor, fechaNacimiento: '2011-01-01' }] },
      'el correo ya es de una cuenta': { usuario: usuario(primero, nuevoDni()), titular, menores: [{ nombre: 'Ana', fechaNacimiento: '2014-01-01' }] },
    };
    for (const [caso, cuerpo] of Object.entries(intentos)) {
      enviados.length = 0;
      const r = await alta(cuerpo);
      assert.equal(r.status, 201, caso);
      assert.deepEqual(await r.json(), cuerpoBueno, `${caso}: la respuesta es la misma que la de un alta hecha`);

      const email = cuerpo.usuario.email;
      if (email !== primero) assert.equal(await db.user.count({ where: { email } }), 0, `${caso}: no se crea la cuenta`);

      await esperarCorreos();
      const aviso = enviados.find((c) => c.to === email);
      assert.ok(aviso, `${caso}: se escribe al correo del formulario`);
      assert.match(aviso.html, /no hemos podido tramitarla/);
      for (const dni of [dniAdulto, dniMenor]) assert.ok(!aviso.html.includes(dni), `${caso}: el correo no dice qué DNI`);
    }

    // Secretaría lo ve en la auditoría, con el motivo y sin el DNI ni el correo en claro.
    const rastros = await db.auditLog.findMany({ where: { action: 'ALTA_NO_TRAMITADA', createdAt: { gte: new Date(Date.now() - 60_000) } } });
    const motivos = rastros.map((r) => (r.detalles as { motivo: string }).motivo);
    for (const motivo of ['dni_de_menor_en_el_censo', 'correo_o_dni_de_cuenta']) assert.ok(motivos.includes(motivo), motivo);
    for (const r of rastros) {
      const texto = JSON.stringify(r.detalles);
      assert.ok(!texto.includes(dniAdulto) && !texto.includes(dniMenor) && !texto.includes(primero), texto);
    }
  });
});
