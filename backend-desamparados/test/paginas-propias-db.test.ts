// Las páginas propias de una corporación (módulo de instalación
// «paginas-propias»): encendidas solo si el fichero de la instalación lo dice.
// Apagadas, la API no las sirve ni deja guardarlas, el sitemap no las anuncia
// y no recogen donativos; las páginas del núcleo (Ajuar) siguen igual. Y el
// módulo no se cuela en la pantalla de Módulos ni se cambia por la API.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { identidad } from '../src/domain/datos-entidad.js';
import { porDefecto } from '../src/domain/contenido.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { DonativoService } from '../src/services/pagos/donativo.service.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { NotFoundError } from '../src/utils/error.handle.js';
import { encenderDeInstalacion } from './fixtures/modulos.js';
import { borrarUsuarioPrueba, crearUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
const DOMINIO = `https://${identidad.dominio}`;
const PROPIAS = ['/desamparados', '/rosario', '/sabado-de-pasion', '/sabado-de-pasion/recorrido', '/sabado-de-pasion/trono', '/sabado-de-pasion/enseres'];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

/** Con el módulo como se pide y, al acabar, como estaba (el ejemplo: apagado). */
async function con<T>(encendido: boolean, prueba: () => Promise<T>): Promise<T> {
  const restaurar = encenderDeInstalacion(encendido ? ['paginas-propias'] : []);
  try {
    return await prueba();
  } finally {
    restaurar();
  }
}

const urls = async () => [...(await (await fetch(`${baseUrl}/sitemap.xml`)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe('el módulo en el servicio', () => {
  test('con el fichero del ejemplo está apagado; encendido, sale entre los activos y en GET /api/modulos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    ModulosService.olvidar();
    assert.ok(!(await ModulosService.activo('paginas-propias')));
    await con(true, async () => {
      assert.ok(await ModulosService.activo('paginas-propias'));
      const { activos } = await (await fetch(`${baseUrl}/api/modulos`)).json() as { activos: string[] };
      assert.ok(activos.includes('paginas-propias'));
    });
    const { activos } = await (await fetch(`${baseUrl}/api/modulos`)).json() as { activos: string[] };
    assert.ok(!activos.includes('paginas-propias'));
  });

  test('ni sale en la pantalla de Módulos, ni tiene fila, ni se cambia por la API', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await con(true, async () => {
      assert.ok(!(await ModulosService.listarCms()).some((m) => (m.clave as string) === 'paginas-propias'));
      assert.equal(await db.modulo.count({ where: { clave: 'paginas-propias' } }), 0);
      await assert.rejects(ModulosService.cambiar('paginas-propias', false, {}, undefined, {}), NotFoundError);
      assert.ok(await ModulosService.activo('paginas-propias'), 'sigue encendido: solo lo apaga el fichero');
    });
  });
});

describe('la API de contenido', () => {
  test('apagado: no se leen, ni se guardan, ni se ve su historial (404 MODULO_NO_ACTIVADO)', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const admin = await crearUsuarioPrueba(Role.ADMIN);
    try {
      await con(false, async () => {
        const cookie = `${COOKIE_CMS}=${generateToken(admin.id, Role.ADMIN, false, 'cms')}`;
        for (const slug of ['desamparados', 'rosario', 'sabado-de-pasion', 'recorrido', 'trono', 'enseres']) {
          const leer = await fetch(`${baseUrl}/api/contenido/${slug}`);
          assert.equal(leer.status, 404, slug);
          assert.equal((await leer.json() as { error: string }).error, 'MODULO_NO_ACTIVADO', slug);
          const guardar = await fetch(`${baseUrl}/api/contenido/${slug}`, {
            method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ datos: porDefecto('rosario') }),
          });
          assert.equal(guardar.status, 404, `${slug}: guardar`);
          assert.equal((await fetch(`${baseUrl}/api/contenido/${slug}/versiones`, { headers: { cookie } })).status, 404, `${slug}: versiones`);
        }
        // El Ajuar es del núcleo: con el módulo apagado se sigue sirviendo.
        assert.equal((await fetch(`${baseUrl}/api/contenido/ajuar`)).status, 200);
      });
    } finally {
      await borrarUsuarioPrueba(admin.id);
    }
  });

  test('encendido: se sirven como siempre', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await con(true, async () => {
      for (const slug of ['desamparados', 'rosario', 'sabado-de-pasion', 'recorrido', 'trono', 'enseres']) {
        assert.equal((await fetch(`${baseUrl}/api/contenido/${slug}`)).status, 200, slug);
      }
    });
  });

  test('apagado, una página suya no recoge donativos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await con(false, async () => {
      await assert.rejects(
        DonativoService.comprobar({ pagina: 'rosario', importe: 10, metodo: 'TARJETA' }),
        (e: unknown) => e instanceof NotFoundError,
      );
    });
  });
});

describe('el sitemap', () => {
  test('apagado no las anuncia; encendido, sí; el Ajuar, siempre', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await con(false, async () => {
      const lista = await urls();
      for (const ruta of PROPIAS) assert.ok(!lista.includes(`${DOMINIO}${ruta}`), `apagado anuncia ${ruta}`);
      assert.ok(lista.includes(`${DOMINIO}/ajuar`));
    });
    await con(true, async () => {
      const lista = await urls();
      for (const ruta of PROPIAS) assert.ok(lista.includes(`${DOMINIO}${ruta}`), `encendido no anuncia ${ruta}`);
    });
  });
});
