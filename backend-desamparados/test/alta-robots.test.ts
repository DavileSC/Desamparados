// test/alta-robots.test.ts
//
// El campo trampa del formulario de alta.
//
// El de contacto ya lo tenía; el del alta no, y es el que crea filas en la base
// y manda correos a Secretaría. Un robot podía dejar veinte solicitudes falsas
// por IP cada cuarto de hora, que es lo único que frenaba el limitador.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { registerSchema } from '../src/schemas/auth.schema.js';
import { trampaRellena } from '../src/domain/senales-de-robot.js';
import { SIN_DB } from './fixtures/sin-db.js';

const PASSWORD = 'Trono-Alameda-84-Verde';
const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dniValido = (n: number) => `${String(n).padStart(8, '0')}${LETRAS[n % 23]}`;

let server: Server;
let baseUrl: string;
let dbDisponible = false;

const marca = Date.now();
const emailDelRobot = `robot.${marca}@ejemplo.test`;

const cuerpo = (extra: Record<string, unknown>) => ({
  usuario: {
    email: emailDelRobot,
    dni: dniValido(marca % 100000000),
    password: PASSWORD,
    nombre: 'Robot',
    apellidos: 'De Prueba',
    telefono: '661223344',
    direccion: 'Calle Alameda 84',
    poblacion: 'Málaga',
    codigoPostal: '29013',
  },
  titular: { fechaNacimiento: '1990-05-14', sexo: 'HOMBRE', estadoCivil: 'SOLTERO', fechaBautismo: '1990-12-28' },
  ...extra,
});

async function sondearDb(): Promise<boolean> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const);
  return (await Promise.race([consulta, timeout])) === 'ok';
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  dbDisponible = await sondearDb();
});

// Si algo fallara y la solicitud llegara a crearse, no se queda en la base.
after(async () => {
  if (dbDisponible) {
    const usuario = await db.user.findUnique({ where: { email: emailDelRobot }, select: { id: true } });
    if (usuario) {
      await db.hermano.deleteMany({ where: { userId: usuario.id } });
      await db.user.delete({ where: { id: usuario.id } });
    }
  }
  server.close();
  await db.$disconnect();
});

const enviar = (datos: unknown) =>
  fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });

describe('el campo trampa del alta', () => {
  test('reconoce lo que escribe un robot y no lo que deja una persona', () => {
    assert.equal(trampaRellena('https://spam.example'), true);
    assert.equal(trampaRellena(''), false, 'la web lo manda vacío siempre');
    assert.equal(trampaRellena('   '), false, 'espacios no son texto');
    assert.equal(trampaRellena(undefined), false, 'una web antigua no lo manda');
  });

  test('el esquema lo admite vacío, con texto y sin él', () => {
    const vale = (body: unknown) =>
      !(registerSchema.onDeepUndeclaredKey('delete')({ body, query: {}, params: {} }) as { summary?: string }).summary;
    assert.ok(vale(cuerpo({ comentarioAdicional: '' })));
    assert.ok(vale(cuerpo({ comentarioAdicional: 'spam' })));
    assert.ok(vale(cuerpo({})), 'sin el campo también vale: una web en caché no lo manda');
    assert.ok(!vale(cuerpo({ comentarioAdicional: 'x'.repeat(201) })), 'no es un cubo donde volcar texto');
  });

  test('con la trampa rellena responde como a una persona y no crea nada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);

    const respuesta = await enviar(cuerpo({ comentarioAdicional: 'https://spam.example' }));

    // Misma respuesta que un alta buena: si el robot notara la diferencia,
    // aprendería a esquivar la trampa.
    assert.equal(respuesta.status, 201);
    const { message } = (await respuesta.json()) as { message: string };
    assert.match(message, /Solicitud enviada correctamente/);

    const usuario = await db.user.findUnique({ where: { email: emailDelRobot } });
    assert.equal(usuario, null, 'no debe quedar ninguna cuenta ni solicitud');
  });
});
