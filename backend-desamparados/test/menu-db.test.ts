// Los nombres de las páginas en el menú público contra MariaDB: se leen sin
// sesión, los cambian quienes editan las páginas, una ruta que no es del menú
// es un 400 que dice cuál, y queda en la auditoría.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { MenuService } from '../src/services/menu.service.js';
import { depurarNombres, TOPE_NOMBRE_EN_MENU } from '../src/domain/menu.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const CLAVE = 'nombres_en_menu';
let server: Server;
let baseUrl: string;
let dbDisponible = false;
let filaAntes: { value: string; descripcion: string | null } | null = null;
const usuarios: Partial<Record<'ADMIN' | 'REDES' | 'HERMANO_MAYOR' | 'TESORERIA', number>> = {};

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  filaAntes = await db.configuracion.findUnique({ where: { key: CLAVE }, select: { value: true, descripcion: true } });
  for (const rol of ['ADMIN', 'REDES', 'HERMANO_MAYOR', 'TESORERIA'] as const) usuarios[rol] = (await crearUsuarioPrueba(Role[rol])).id;
});

after(async () => {
  server.close();
  if (dbDisponible) {
    // Lo que hubiera, como estaba: la base de desarrollo tiene los nombres de verdad.
    if (filaAntes) await db.configuracion.update({ where: { key: CLAVE }, data: filaAntes });
    else await db.configuracion.deleteMany({ where: { key: CLAVE } });
    MenuService.olvidar();
    await db.auditLog.deleteMany({ where: { action: ACCIONES_AUDITORIA.MENU_NOMBRES_ACTUALIZAR, userId: { in: Object.values(usuarios) } } });
    for (const id of Object.values(usuarios)) await borrarUsuarioPrueba(id);
  }
  await db.$disconnect();
});

async function pedir(ruta: string, { rol, metodo = 'GET', cuerpo }: { rol?: keyof typeof usuarios; metodo?: string; cuerpo?: unknown } = {}) {
  const res = await fetch(`${baseUrl}/api${ruta}`, {
    method: metodo,
    headers: {
      ...(rol ? { Cookie: `${COOKIE_CMS}=${generateToken(usuarios[rol]!, rol)}` } : {}),
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  return { status: res.status, cache: res.headers.get('cache-control'), cuerpo: texto ? JSON.parse(texto) : null };
}

const guardar = (rol: keyof typeof usuarios, nombres: unknown) => pedir('/cms/menu', { rol, metodo: 'PUT', cuerpo: { nombres } });

describe('depurarNombres', () => {
  test('se queda solo con los nombres que cambian algo, de rutas del menú', () => {
    assert.deepEqual(depurarNombres({
      '/parroquia': '  Parroquia · Pasionistas ',
      '/contacto': 'Contacto',
      '/cultos': '   ',
      '/no-existe': 'Nada',
      '/corporacion': 'Título que solo despliega',
      '/ajuar': 'x'.repeat(TOPE_NOMBRE_EN_MENU + 1),
      '/agenda': '<b>Agenda</b>',
      '/noticias': 7,
    }), { '/parroquia': 'Parroquia · Pasionistas' });
    assert.deepEqual(depurarNombres('no es un objeto'), {});
    assert.deepEqual(depurarNombres(['/parroquia']), {});
  });
});

describe('los nombres del menú', () => {
  test('sin fila, ninguno: se leen sin sesión y con la caché del contenido', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.configuracion.deleteMany({ where: { key: CLAVE } });
    MenuService.olvidar();
    const res = await pedir('/menu');
    assert.equal(res.status, 200);
    assert.deepEqual(res.cuerpo, { nombres: {} });
    assert.equal(res.cache, 'public, no-cache');
  });

  test('los cambian quienes editan las páginas, y Administración', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const nombres = { '/parroquia': 'Parroquia · Pasionistas' };
    assert.equal((await pedir('/cms/menu', { metodo: 'PUT', cuerpo: { nombres } })).status, 401);
    assert.equal((await guardar('TESORERIA', nombres)).status, 403);
    for (const rol of ['ADMIN', 'REDES', 'HERMANO_MAYOR'] as const) assert.equal((await guardar(rol, nombres)).status, 200, rol);
  });

  test('guardar recorta, quita los vacíos y los de siempre, audita y la web lo ve sin reiniciar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await guardar('REDES', { '/parroquia': '  Parroquia · Pasionistas ', '/cultos': '', '/contacto': 'Contacto', '/agenda': 'Calendario' });
    assert.equal(res.status, 200);
    const esperado = { '/parroquia': 'Parroquia · Pasionistas', '/agenda': 'Calendario' };
    assert.deepEqual(res.cuerpo, { nombres: esperado });
    assert.deepEqual((await pedir('/menu')).cuerpo, { nombres: esperado });
    // Y tras un reinicio, de la base.
    MenuService.olvidar();
    assert.deepEqual((await pedir('/menu')).cuerpo, { nombres: esperado });
    const auditoria = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.MENU_NOMBRES_ACTUALIZAR, userId: usuarios.REDES }, orderBy: { id: 'desc' } });
    assert.ok(auditoria, 'no quedó en la auditoría');
  });

  test('una ruta que no es del menú, un nombre largo o con < > son 400 que dicen cuál, y no cambian nada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = (await pedir('/menu')).cuerpo;
    const desconocida = await guardar('ADMIN', { '/no-existe': 'Nada' });
    assert.equal(desconocida.status, 400);
    assert.deepEqual(desconocida.cuerpo.errors, [{ field: 'nombres./no-existe', message: 'No es una entrada del menú' }]);
    // Un título que solo despliega no es una página: tampoco se renombra.
    assert.equal((await guardar('ADMIN', { '/corporacion': 'La casa' })).status, 400);
    const largo = await guardar('ADMIN', { '/ajuar': 'x'.repeat(TOPE_NOMBRE_EN_MENU + 1) });
    assert.equal(largo.status, 400);
    assert.equal(largo.cuerpo.errors[0].field, 'nombres./ajuar');
    assert.equal((await guardar('ADMIN', { '/ajuar': '<i>Ajuar</i>' })).status, 400);
    assert.equal((await guardar('ADMIN', { '/ajuar': 3 })).status, 400);
    assert.equal((await pedir('/cms/menu', { rol: 'ADMIN', metodo: 'PUT', cuerpo: {} })).status, 400);
    assert.deepEqual((await pedir('/menu')).cuerpo, antes);
  });

  test('cambiar uno solo lo mezcla con lo guardado, también con dos a la vez', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const cambiar = (ruta: string, nombre: string) => pedir('/cms/menu', { rol: 'REDES', metodo: 'PATCH', cuerpo: { ruta, nombre } });
    assert.equal((await guardar('ADMIN', { '/parroquia': 'Parroquia · Pasionistas' })).status, 200);
    const [a, b] = await Promise.all([cambiar('/agenda', ' Calendario '), cambiar('/cultos', 'Culto y oración')]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const esperado = { '/parroquia': 'Parroquia · Pasionistas', '/agenda': 'Calendario', '/cultos': 'Culto y oración' };
    assert.deepEqual((await pedir('/menu')).cuerpo, { nombres: esperado });
    // Vacío, vuelve el de siempre y los demás se quedan.
    assert.deepEqual((await cambiar('/agenda', '')).cuerpo, { nombres: { '/parroquia': 'Parroquia · Pasionistas', '/cultos': 'Culto y oración' } });
    const malo = await cambiar('/no-existe', 'Nada');
    assert.equal(malo.status, 400);
    assert.equal(malo.cuerpo.errors[0].field, 'ruta');
    assert.equal((await cambiar('/ajuar', '<i>Ajuar</i>')).status, 400);
    assert.equal((await pedir('/cms/menu', { rol: 'TESORERIA', metodo: 'PATCH', cuerpo: { ruta: '/agenda', nombre: 'x' } })).status, 403);
  });

  test('una fila rota no deja la web sin menú: salen los de siempre', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.configuracion.update({ where: { key: CLAVE }, data: { value: '{roto' } });
    MenuService.olvidar();
    const errorDeAntes = console.error;
    console.error = () => {};
    try {
      assert.deepEqual((await pedir('/menu')).cuerpo, { nombres: {} });
    } finally {
      console.error = errorDeAntes;
    }
  });
});
