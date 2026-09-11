// test/portada.test.ts
//
// Las fotos de la cabecera de la portada. La validación del cuerpo y el 401 sin
// sesión no tocan la base de datos y corren siempre; la lectura pública y el
// guardado como staff necesitan MariaDB y se omiten si no está levantada.
//
// El primer import aísla storage/ en una carpeta temporal: sustituir la lista
// borra del disco las fotos que salen de ella (utils/ficheros-publicos.ts), y
// este test sustituye la lista de la base de desarrollo, cuyas fotos viven en
// el storage del repositorio.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { ArkErrors } from 'arktype';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_SESION } from '../src/utils/cookies.js';
import { guardarImagenesPortadaSchema, MAX_IMAGENES_PORTADA } from '../src/schemas/portada.schema.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const validar = (imagenes: unknown) => guardarImagenesPortadaSchema({ body: { imagenes } });
const esError = (resultado: unknown) => resultado instanceof ArkErrors;

describe('validación de las fotos de portada', () => {
  test('acepta lo que devuelve la subida del CMS y las imágenes estáticas de la web', () => {
    const imagenes = [
      { url: '/storage/public/0123456789abcdef0123456789abcdef.webp', descripcion: 'La Virgen en su trono' },
      { url: '/storage/public/portada/01-trono.webp' },
      { url: '/images/hero-1920.webp', descripcion: '' },
    ];
    assert.ok(!esError(validar(imagenes)));
  });

  test('rechaza direcciones externas, esquemas y archivos que no son imágenes', () => {
    for (const url of [
      'https://ejemplo.com/foto.jpg',
      'javascript:alert(1)',
      '/storage/private/0123456789abcdef0123456789abcdef.jpg',
      '/storage/public/documento.pdf',
      '/storage/public/../secreto.jpg',
      'images/hero.jpg',
    ]) {
      assert.ok(esError(validar([{ url }])), `debería rechazar ${url}`);
    }
  });

  test('la descripción es texto alternativo: sin etiquetas y con un tope de longitud', () => {
    assert.ok(esError(validar([{ url: '/images/hero.jpg', descripcion: '<img src=x onerror=alert(1)>' }])));
    assert.ok(esError(validar([{ url: '/images/hero.jpg', descripcion: 'x'.repeat(201) }])));
  });

  test(`no admite más de ${MAX_IMAGENES_PORTADA} fotos`, () => {
    const una = { url: '/images/hero.jpg' };
    assert.ok(!esError(validar(Array(MAX_IMAGENES_PORTADA).fill(una))));
    assert.ok(esError(validar(Array(MAX_IMAGENES_PORTADA + 1).fill(una))));
  });

  test('la lista es obligatoria', () => {
    assert.ok(esError(guardarImagenesPortadaSchema({ body: {} })));
    assert.ok(esError(validar('no-es-una-lista')));
  });
});

let server: Server;
let baseUrl: string;
let dbDisponible = false;
let motivoSinDb = '';
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const usuarios: Record<string, number> = {};

async function sondearDb(): Promise<boolean> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000).unref());
  const consulta = db.$queryRaw`SELECT 1`
    .then(() => 'ok' as const)
    .catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
  const resultado = await Promise.race([consulta, timeout]);
  if (resultado === 'ok') return true;
  motivoSinDb = resultado === 'timeout'
    ? `la conexión no respondió en 3 s (DATABASE_HOST=${process.env.DATABASE_HOST ?? 'sin definir'})`
    : resultado.message;
  return false;
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  dbDisponible = await sondearDb();
  if (!dbDisponible) {
    console.log(`\nℹ  Sin conexión a la base de datos: se omiten los tests que la necesitan.\n   Motivo: ${motivoSinDb}\n`);
    return;
  }
  for (const rol of [Role.USER, Role.REDES, Role.TESORERIA]) {
    usuarios[rol] = (await crearUsuarioPrueba(rol)).id;
  }
});

after(async () => {
  server.close();
  for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
  await db.$disconnect();
});

const guardar = (imagenes: unknown, rol?: Role) =>
  fetch(`${baseUrl}/api/portada/imagenes`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(rol ? { Cookie: `${COOKIE_SESION}=${generateToken(usuarios[rol]!, rol)}` } : {}),
    },
    body: JSON.stringify({ imagenes }),
  });

describe('acceso a las fotos de portada', () => {
  test('guardar sin sesión responde 401', async () => {
    assert.equal((await guardar([])).status, 401);
  });

  test('la lectura es pública y devuelve la lista ordenada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await fetch(`${baseUrl}/api/portada/imagenes`);
    assert.equal(res.status, 200);
    const lista = (await res.json()) as { orden: number }[];
    assert.ok(Array.isArray(lista));
    assert.deepEqual(lista.map((i) => i.orden), lista.map((i) => i.orden).sort((a, b) => a - b));
  });

  test('un hermano raso y la tesorería no pueden tocar la portada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await guardar([], Role.USER)).status, 403);
    assert.equal((await guardar([], Role.TESORERIA)).status, 403);
  });

  test('el community manager sustituye la lista y el orden que manda es el que se lee', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Se guarda lo que hubiera para dejarlo como estaba: este test corre contra
    // la base de desarrollo, no contra una vacía.
    const anterior = await PortadaServiceLista();
    try {
      const nuevas = [
        { url: '/images/hero-1920.webp', descripcion: 'Primera' },
        { url: '/storage/public/0123456789abcdef0123456789abcdef.jpg', descripcion: '   ' },
      ];
      const res = await guardar(nuevas, Role.REDES);
      assert.equal(res.status, 200, await res.text());

      const lista = (await (await fetch(`${baseUrl}/api/portada/imagenes`)).json()) as { url: string; descripcion: string | null; orden: number }[];
      assert.deepEqual(lista.map((i) => [i.url, i.descripcion, i.orden]), [
        ['/images/hero-1920.webp', 'Primera', 0],
        // Una descripción en blanco se guarda como nula, no como espacios.
        ['/storage/public/0123456789abcdef0123456789abcdef.jpg', null, 1],
      ]);

      assert.equal((await guardar([{ url: 'https://fuera.com/x.jpg' }], Role.REDES)).status, 400);
    } finally {
      await guardar(anterior, Role.REDES);
    }
  });
});

async function PortadaServiceLista() {
  const lista = (await (await fetch(`${baseUrl}/api/portada/imagenes`)).json()) as { url: string; descripcion: string | null }[];
  return lista.map((i) => ({ url: i.url, descripcion: i.descripcion ?? '' }));
}
