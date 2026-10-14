// Apagado un módulo, sus rutas responden 404 MODULO_NO_ACTIVADO y las del
// núcleo siguen; encendido, vuelven. Se apaga escribiendo en la tabla (sin la
// regla de dependencias, que ya prueba modulos-db.test.ts) y recargando.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { CLAVES_MODULO, type ClaveModulo } from '../src/domain/modulos.js';
import { SIN_DB } from './fixtures/sin-db.js';

let dbDisponible = false;
/** Cómo estaban los módulos antes de empezar, para dejarlos igual y no encender lo que la base tenía apagado. */
let foto: { clave: string; activo: boolean }[] = [];
let server: Server;
let baseUrl: string;
let admin: { id: number; cookie: string };

/** Una ruta de cada módulo. Con el módulo encendido puede responder lo que sea (200, 400, un 404 natural): lo que no puede es decir MODULO_NO_ACTIVADO. */
const RUTAS: Record<ClaveModulo, { method?: string; ruta: string }[]> = {
  noticias: [{ ruta: '/api/news' }, { ruta: '/api/contenido/noticias' }],
  publicaciones: [{ ruta: '/api/publications' }, { ruta: '/api/contenido/publicaciones' }, { ruta: '/api/contenido/dossier-prensa' }],
  agenda: [{ ruta: '/api/events' }, { ruta: '/api/contenido/agenda' }],
  comunicados: [{ ruta: '/api/comunicados' }],
  'alta-web': [{ method: 'POST', ruta: '/api/auth/register' }, { method: 'POST', ruta: '/api/auth/reactivacion' }],
  'area-hermanos': [], // se prueba en modulos-area-hermanos-db.test.ts
  procesion: [{ ruta: '/api/procesion/dias' }, { ruta: '/api/salidas' }, { ruta: '/api/cms/salidas' }, { ruta: '/api/ropero/cingulos' }],
  puerta: [{ ruta: '/api/procesion/admin/puerta' }],
  'cortejo-directo': [{ ruta: '/api/cortejo-directo' }],
  inventario: [{ ruta: '/api/inventario/enseres' }, { ruta: '/api/inventario/dashboard' }],
  cartas: [{ ruta: '/api/cartas' }],
  difuntos: [{ ruta: '/api/hermanos/admin/difuntos' }, { method: 'DELETE', ruta: '/api/hermanos/admin/sufragios/1' }],
  apadrinamientos: [{ ruta: '/api/apadrinamientos' }],
  remesas: [{ ruta: '/api/recibos/admin/remesas' }, { method: 'POST', ruta: '/api/recibos/admin/remesas/norma43/previa' }],
  'pago-en-linea': [{ ruta: '/api/pagos/metodos' }],
  'cuotas-en-linea': [{ method: 'POST', ruta: '/api/recibos/mis-recibos/pagar' }, { ruta: '/api/recibos/mis-recibos/pagos/abc' }],
  donativos: [{ method: 'POST', ruta: '/api/pagos/donativo' }, { ruta: '/api/pagos/donativo/abc' }],
  tienda: [{ ruta: '/api/tienda/admin' }],
  'tienda-web': [{ ruta: '/api/tienda' }, { ruta: '/api/tienda/pedidos/abc' }],
  loteria: [{ ruta: '/api/loteria' }],
  'modelo-182': [{ ruta: '/api/recibos/admin/modelo-182' }, { ruta: '/api/recibos/mis-recibos/certificados' }],
  contabilidad: [{ ruta: '/api/transacciones' }],
  cabildos: [{ ruta: '/api/cabildos' }],
  'informe-anual': [{ ruta: '/api/datos/informe-anual/2025' }],
  'avisos-en-el-movil': [{ ruta: '/api/auth/moviles' }, { method: 'POST', ruta: '/api/auth/login/aprobacion' }, { method: 'POST', ruta: '/api/auth/aprobacion/abc' }],
};

/** Rutas del núcleo que tienen que seguir aunque TODO esté apagado. */
const NUCLEO = ['/api/modulos', '/api/auth/me', '/api/recibos/admin/resumen', '/api/datos', '/api/panel', '/api/cms/modulos'];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  foto = await db.modulo.findMany({ select: { clave: true, activo: true } });
  // Las rutas del área (/mis-recibos…) miran además «Área de hermanos»: si la
  // base lo tenía apagado, encendido el módulo de la ruta seguiría el 404.
  await ponerEnBase(['area-hermanos'], true);
  const u = await crearUsuarioPrueba(Role.ADMIN);
  // Las dos sesiones, como un cargo con el CMS y el área abiertos: las rutas
  // del área (/mis-recibos, /procesion/dias) solo valen con la suya.
  admin = {
    id: u.id,
    cookie: `${COOKIE_CMS}=${generateToken(u.id, Role.ADMIN, false, 'cms')}; ${COOKIE_HERMANO}=${generateToken(u.id, Role.ADMIN, false, 'hermanos')}`,
  };
});

after(async () => {
  if (dbDisponible) {
    await restaurar();
    await borrarUsuarioPrueba(admin.id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

async function restaurar() {
  for (const fila of foto) await db.modulo.update({ where: { clave: fila.clave }, data: { activo: fila.activo } });
  await ModulosService.cargar();
}

async function ponerEnBase(claves: readonly string[], activo: boolean) {
  await db.modulo.updateMany({ where: { clave: { in: [...claves] } }, data: { activo } });
  await ModulosService.cargar();
}

async function respuesta(method: string, ruta: string) {
  const r = await fetch(`${baseUrl}${ruta}`, { method, headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
  const texto = await r.text();
  let error: string | undefined;
  try { error = (JSON.parse(texto) as { error?: string }).error; } catch { /* no es JSON (un PDF, un 404 de Express) */ }
  return { status: r.status, error };
}

test('cada módulo apagado responde MODULO_NO_ACTIVADO en sus rutas; encendido, no', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  for (const clave of CLAVES_MODULO) {
    for (const { method = 'GET', ruta } of RUTAS[clave]) {
      await ponerEnBase([clave], false);
      const apagado = await respuesta(method, ruta);
      assert.equal(apagado.status, 404, `${clave}: ${method} ${ruta} apagado respondió ${apagado.status}`);
      assert.equal(apagado.error, 'MODULO_NO_ACTIVADO', `${clave}: ${method} ${ruta} apagado`);
      await ponerEnBase([clave], true);
      const encendido = await respuesta(method, ruta);
      assert.notEqual(encendido.error, 'MODULO_NO_ACTIVADO', `${clave}: ${method} ${ruta} encendido`);
    }
  }
});

test('con todo apagado, el núcleo sigue respondiendo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await ponerEnBase(CLAVES_MODULO, false);
  for (const ruta of NUCLEO) {
    const r = await respuesta('GET', ruta);
    assert.notEqual(r.error, 'MODULO_NO_ACTIVADO', ruta);
    assert.ok(r.status < 500, `${ruta} respondió ${r.status}`);
  }
  await ponerEnBase(CLAVES_MODULO, true);
});

test('el aviso del banco no se apaga nunca: un pago empezado antes es dinero real', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await ponerEnBase(['pago-en-linea', 'donativos'], false);
  const r = await fetch(`${baseUrl}/api/pagos/redsys/notificacion`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  assert.notEqual(r.status, 404);
  await ponerEnBase(['pago-en-linea', 'donativos'], true);
});
