// test/documentos-privados.test.ts
//
// Los documentos del alta (foto y certificado de bautismo) en storage/private.
// La foto se guarda como <hex>.webp y el filtro de nombres no admitía webp:
// al rechazar una solicitud, suprimir una cuenta o borrar una ficha, la foto
// se quedaba en el disco para siempre. Y la limpieza de huérfanos solo miraba
// storage/public.
//
// El primer import aísla storage/ en una carpeta temporal.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import db from '../src/config/db.js';
import { privateStorageDir } from '../src/middleware/upload.middleware.js';
import {
  borrarDocumentosPrivados, buscarDocumentosHuerfanos, documentosPrivadosReferenciados,
} from '../src/utils/documentos-privados.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const hex = () => randomBytes(16).toString('hex');
const enDisco = (nombre: string) => existsSync(path.join(privateStorageDir, nombre));

async function crear(nombre: string, horasAtras = 48) {
  const ruta = path.join(privateStorageDir, nombre);
  await writeFile(ruta, 'x');
  const cuando = new Date(Date.now() - horasAtras * 3600_000);
  await utimes(ruta, cuando, cuando);
}

describe('borrar los documentos de una ficha', () => {
  test('la foto en webp se borra como las demás', async () => {
    const foto = `${hex()}.webp`;
    const certificado = `${hex()}.pdf`;
    await crear(foto);
    await crear(certificado);
    assert.equal(await borrarDocumentosPrivados([foto, certificado, null]), 2);
    assert.ok(!enDisco(foto), 'la foto webp sigue en el disco');
    assert.ok(!enDisco(certificado));
  });

  test('un nombre que no es de una subida no se toca', async () => {
    assert.equal(await borrarDocumentosPrivados(['../public/algo.webp', 'notas.txt', `${hex()}.exe`]), 0);
  });
});

describe('documentos huérfanos', () => {
  let dbDisponible = false;
  let usuarioId = 0;
  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
  });
  after(async () => {
    if (usuarioId) {
      await db.hermano.deleteMany({ where: { userId: usuarioId } });
      await borrarUsuarioPrueba(usuarioId);
    }
    await db.$disconnect();
  });

  test('solo lo que no menciona ninguna ficha y no es de las últimas horas', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const usuario = await crearUsuarioPrueba();
    usuarioId = usuario.id;
    const foto = `${hex()}.webp`;
    const certificado = `${hex()}.PDF`;
    const suelto = `${hex()}.webp`;
    const reciente = `${hex()}.jpg`;
    for (const nombre of [foto, certificado, suelto]) await crear(nombre);
    await crear(reciente, 1);
    await writeFile(path.join(privateStorageDir, 'leeme.txt'), 'no es una subida');
    await db.hermano.create({
      data: {
        userId: usuario.id, nombre: 'Prueba', apellidos: 'Documentos', dni: `P${hex().slice(0, 12)}`,
        fechaNacimiento: new Date('1990-01-01'), activo: false, esTitular: true,
        // La ficha guarda el nombre tal como lo puso la subida, mayúsculas incluidas.
        foto, certificadoBautismo: certificado,
      },
    });

    const referenciados = await documentosPrivadosReferenciados();
    const { huerfanos, ignorados } = await buscarDocumentosHuerfanos({ referenciados });
    const nombres = huerfanos.map((h) => h.nombre);
    assert.ok(nombres.includes(suelto), 'el suelto es huérfano');
    assert.ok(!nombres.includes(foto), 'la foto de la ficha sigue en uso');
    assert.ok(!nombres.includes(certificado), 'el certificado de la ficha sigue en uso');
    assert.ok(!nombres.includes(reciente), 'lo de las últimas horas puede ser un alta a medias');
    assert.ok(ignorados.includes('leeme.txt'));
  });
});
