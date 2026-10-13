// Primero: aísla `storage/` en una carpeta temporal antes de que se cargue
// upload.middleware.ts (ver el fixture). Este fichero crea ficheros de prueba.
import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { ArkErrors } from 'arktype';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { email } from '../src/config/common.js';
import { publicStorageDir } from '../src/middleware/upload.middleware.js';

/**
 * Límites de cuerpo, cabeceras y estáticos de `app.ts`. Ninguno necesita base
 * de datos: todo se decide antes de llegar a los controladores.
 *
 * El formulario de contacto no tiene sesión: con el tope de 2 MB para toda la
 * API y un `email` sin longitud máxima, cualquiera podía hacer trabajar al
 * servidor con una «dirección» gigante. Ahora el tope general es 100 KB y solo
 * las rutas del HTML del CMS admiten 2 MB.
 */

let server: Server;
let baseUrl: string;
const carpeta = path.join(publicStorageDir, '__test-servidor');

before(async () => {
  await mkdir(carpeta, { recursive: true });
  await writeFile(path.join(carpeta, 'foto.txt'), 'x');
  await writeFile(path.join(carpeta, '.oculto'), 'secreto');
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(carpeta, { recursive: true, force: true });
  // Las guardas de módulo consultan la base en la primera petición: sin
  // desconectar, el pool de Prisma queda abierto y el runner no avanza al
  // siguiente fichero.
  await db.$disconnect();
});

/** Un JSON de unos `kb` kilobytes. */
function cuerpoDe(kb: number): string {
  return JSON.stringify({ relleno: 'a'.repeat(kb * 1024) });
}

function postJson(ruta: string, cuerpo: string): Promise<Response> {
  return fetch(`${baseUrl}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo,
  });
}

describe('límite del cuerpo JSON', () => {
  test('un cuerpo de 200 KB al formulario de contacto se corta con 413', async () => {
    const res = await postJson('/api/contact', cuerpoDe(200));
    assert.equal(res.status, 413);
    const body = await res.json() as { error?: string };
    assert.equal(body.error, 'El contenido enviado es demasiado grande.');
  });

  test('el mismo cuerpo a /api/auth/login también se corta: el tope es general', async () => {
    const res = await postJson('/api/auth/login', cuerpoDe(200));
    assert.equal(res.status, 413);
  });

  for (const ruta of ['/api/news', '/api/publications']) {
    test(`${ruta} admite 200 KB de HTML del CMS (llega a la autenticación, no se corta)`, async () => {
      const res = await postJson(ruta, cuerpoDe(200));
      assert.notEqual(res.status, 413);
      // Sin sesión: lo para la autenticación, señal de que el cuerpo se leyó.
      assert.equal(res.status, 401);
    });
  }

  test('/api/news sigue teniendo tope: 3 MB dan 413', async () => {
    const res = await postJson('/api/news', cuerpoDe(3 * 1024));
    assert.equal(res.status, 413);
  });

  test('un cuerpo pequeño al contacto sigue llegando a la validación', async () => {
    const res = await postJson('/api/contact', JSON.stringify({ nombre: 'x' }));
    assert.equal(res.status, 400);
  });

  test('un JSON malformado da 400 con mensaje en español', async () => {
    const res = await postJson('/api/news', '{"titulo": ');
    assert.equal(res.status, 400);
    const body = await res.json() as { error?: string };
    assert.equal(body.error, 'El cuerpo de la petición no es un JSON válido.');
  });

  test('los formularios urlencoded ya no se interpretan', async () => {
    // Sin express.urlencoded el cuerpo no se lee: `email=...` no llega como
    // campo y la validación lo rechaza por vacío.
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'nombre=Ana&email=ana%40ejemplo.org&telefono=600000000&asunto=Hola&mensaje=Un+mensaje+largo',
    });
    assert.equal(res.status, 400);
    const body = await res.json() as { message?: string };
    assert.equal(body.message, 'Error de validación');
  });
});

describe('tipo email', () => {
  test('acepta direcciones normales', () => {
    for (const valor of ['ana@ejemplo.org', "o'brien@correo.es", 'nombre.apellido+etiqueta@sub.dominio.com']) {
      assert.ok(!(email(valor) instanceof ArkErrors), `${valor} debería ser válida`);
    }
  });

  test('rechaza listas de direcciones y sintaxis de nombre', () => {
    for (const valor of ['a@b.com,c@d.com', 'a@b.com;c@d.com', 'Ana <ana@b.com>', '"ana"@b.com', 'a@b.com,,,,,,']) {
      assert.ok(email(valor) instanceof ArkErrors, `${valor} no debería pasar`);
    }
  });

  test('rechaza más de 254 caracteres', () => {
    const larga = `${'a'.repeat(64)}@${'b'.repeat(186)}.com`; // 255
    assert.equal(larga.length, 255);
    assert.ok(email(larga) instanceof ArkErrors);
    assert.ok(!(email(larga.slice(1)) instanceof ArkErrors));
  });
});

describe('cabeceras y estáticos', () => {
  test('/api/health responde por la ruta que nginx sí manda a Node', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json() as { status?: string }).status, 'ok');
  });

  test('la API va con CORP same-origin y sin dejarse enmarcar', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.match(res.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  test('los archivos públicos se pueden incrustar desde otro origen', async () => {
    const res = await fetch(`${baseUrl}/storage/public/__test-servidor/foto.txt`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  });

  test('los ficheros ocultos no se sirven', async () => {
    const res = await fetch(`${baseUrl}/storage/public/__test-servidor/.oculto`);
    assert.notEqual(res.status, 200);
    assert.ok(!(await res.text()).includes('secreto'));
  });

  test('una carpeta no redirige ni lista su contenido', async () => {
    const sinBarra = await fetch(`${baseUrl}/storage/public/__test-servidor`, { redirect: 'manual' });
    assert.equal(sinBarra.status, 404);
    const conBarra = await fetch(`${baseUrl}/storage/public/__test-servidor/`, { redirect: 'manual' });
    assert.equal(conBarra.status, 404);
  });
});

describe('CORS', () => {
  // La mesa de la procesión y las categorías contables usan PATCH; sin él en
  // la lista, el navegador cortaba la petición en la comprobación previa
  // cuando la web y la API no comparten origen.
  test('la comprobación previa admite PATCH', async () => {
    const respuesta = await fetch(`${baseUrl}/api/procesion/admin/papeletas/1`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PATCH' },
    });
    assert.match(respuesta.headers.get('access-control-allow-methods') ?? '', /(^|,)PATCH(,|$)/);
  });
});
