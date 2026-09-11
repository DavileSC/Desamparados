import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { Prisma } from '@prisma/client';
import { registroPeticiones } from '../src/config/registro.js';
import { describirErrorParaLog, rutaParaRegistro } from '../src/utils/log-privacidad.js';

/**
 * Qué llega a los registros en producción.
 *
 * morgan('dev') escribía la URL completa —la búsqueda del censo va en `?q=`
 * con nombres y DNI— y sin fecha ni IP; y los 500 volcaban el error de Prisma
 * tal cual, con los argumentos de la consulta dentro.
 */

describe('rutaParaRegistro', () => {
  test('quita la consulta', () => {
    assert.equal(rutaParaRegistro('/api/hermanos?q=12345678Z&page=2'), '/api/hermanos');
    assert.equal(rutaParaRegistro('/reset-password?token=abc'), '/reset-password');
  });

  test('deja las rutas sin consulta tal cual', () => {
    assert.equal(rutaParaRegistro('/api/auth/reset-password/confirmar'), '/api/auth/reset-password/confirmar');
    assert.equal(rutaParaRegistro('/api/auth/reset-password'), '/api/auth/reset-password');
  });
});

describe('registro de accesos en producción', () => {
  let server: Server;
  let baseUrl: string;
  const lineas: string[] = [];

  before(async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(registroPeticiones('production', { write: (linea) => { lineas.push(linea); } }));
    app.get('/api/hermanos', (_req, res) => { res.json({ ok: true }); });
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('lleva fecha, IP, método, ruta sin consulta, estado y tiempo', async () => {
    await fetch(`${baseUrl}/api/hermanos?q=Garc%C3%ADa%2012345678Z`, { headers: { 'X-Forwarded-For': '203.0.113.7' } });
    // morgan escribe al terminar la respuesta: se espera un instante.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const linea = lineas.at(-1) ?? '';
    assert.match(linea, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z 203\.0\.113\.7 GET \/api\/hermanos 200 \d+ - [\d.]+ ms\n$/, linea);
    assert.ok(!linea.includes('12345678Z'));
    assert.ok(!linea.includes('Garc'));
  });
});

describe('describirErrorParaLog', () => {
  test('de un error de Prisma deja el tipo, el código, el resumen y la pila, no los argumentos', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Invalid `db.user.update()` invocation in\n/srv/app.ts:9:3\n\n  where: { email: "ana@ejemplo.org" }\n\nUnique constraint failed on the constraint: `User_dni_key`',
      {
        code: 'P2002',
        clientVersion: '7.0.0',
        meta: {
          modelName: 'User',
          driverAdapterError: { cause: { originalCode: '1062', originalMessage: "Duplicate entry '12345678Z' for key 'User_dni_key'", kind: 'UniqueConstraintViolation', constraint: { index: 'User_dni_key' } } },
        },
      }
    );
    const texto = describirErrorParaLog(error);
    assert.ok(!texto.includes('ana@ejemplo.org'), texto);
    assert.ok(!texto.includes('12345678Z'), texto);
    assert.match(texto, /PrismaClientKnownRequestError P2002/);
    assert.match(texto, /Unique constraint failed on the constraint: `User_dni_key`/);
    assert.match(texto, /modelo=User/);
    assert.match(texto, /restriccion=User_dni_key/);
    assert.match(texto, /\n {4}at /, 'debe llevar la pila');
  });

  test('tapa los literales del resumen si el mensaje de la base cita un valor', () => {
    const error = new Prisma.PrismaClientUnknownRequestError("Duplicate entry 'ana@ejemplo.org' for key 'User_email_key'", { clientVersion: '7.0.0' });
    const texto = describirErrorParaLog(error);
    assert.ok(!texto.includes('ana@ejemplo.org'), texto);
  });

  test('de un error suelto del adaptador de MariaDB tapa el valor citado', () => {
    const error = Object.assign(new Error("Duplicate entry '12345678Z' for key 'Hermano_dni_key'"), {
      name: 'DriverAdapterError',
      cause: { kind: 'mysql', code: 1062 },
    });
    const texto = describirErrorParaLog(error);
    assert.ok(!texto.includes('12345678Z'), texto);
    assert.match(texto, /DriverAdapterError: Duplicate entry '…'/);
    assert.match(texto, /tipo=mysql \| codigoBD=1062/);
  });

  test('de un error normal deja nombre, mensaje, código y pila', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3310'), { code: 'ECONNREFUSED' });
    const texto = describirErrorParaLog(error);
    assert.match(texto, /^Error: connect ECONNREFUSED 127\.0\.0\.1:3310 \| code=ECONNREFUSED\n {4}at /);
  });

  test('aguanta valores que no son errores', () => {
    assert.equal(describirErrorParaLog(null), 'null');
    assert.match(describirErrorParaLog('texto'), /valor lanzado de tipo string/);
  });
});
