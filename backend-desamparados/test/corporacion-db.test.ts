// Secretaría, sede, redes y privacidad contra MariaDB: la primera vez se
// siembran del fichero, se leen sin sesión, solo Secretaría y Administración
// los cambian, y lo guardado llega a los correos sin reiniciar.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import { ArkErrors } from 'arktype';
import { corporacionSchema } from '../src/schemas/corporacion.schema.js';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { CorporacionService } from '../src/services/corporacion.service.js';
import { contactoDelFichero, lineasDeSecretaria, secretaria } from '../src/domain/datos-entidad.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const CLAVE = 'corporacion_contacto';
let server: Server;
let baseUrl: string;
let dbDisponible = false;
let filaAntes: { value: string; descripcion: string | null } | null = null;
const usuarios: Partial<Record<'ADMIN' | 'SECRETARIA' | 'REDES', number>> = {};

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  filaAntes = await db.configuracion.findUnique({ where: { key: CLAVE }, select: { value: true, descripcion: true } });
  for (const rol of ['ADMIN', 'SECRETARIA', 'REDES'] as const) usuarios[rol] = (await crearUsuarioPrueba(Role[rol])).id;
});

after(async () => {
  server.close();
  if (dbDisponible) {
    // Lo que hubiera, como estaba: la base de desarrollo tiene los datos de verdad.
    // Sin volver a cargar: las pruebas leen el fichero de ejemplo, y la siembra
    // dejaría sus datos en la base de desarrollo. La API la sembrará con los
    // suyos al arrancar.
    if (filaAntes) await db.configuracion.update({ where: { key: CLAVE }, data: filaAntes });
    else await db.configuracion.deleteMany({ where: { key: CLAVE } });
    CorporacionService.olvidar();
    await db.auditLog.deleteMany({ where: { action: ACCIONES_AUDITORIA.CORPORACION_ACTUALIZAR, userId: { in: Object.values(usuarios) } } });
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
  return { status: res.status, cuerpo: texto ? JSON.parse(texto) : null };
}

const NUEVOS = {
  secretaria: { horario: 'Lunes, de 19:00 a 20:00', telefono: '600 11 22 33', email: 'secretaria@prueba.example' },
  sede: { nombre: 'Casa de prueba', calle: 'C. de la Prueba, 7', codigoPostal: '41001', localidad: 'Villaprueba' },
  redes: { facebook: null, instagram: 'https://www.instagram.com/prueba/', x: '', tiktok: null, youtube: null },
  privacidad: { emailDerechos: '' },
};

describe('los datos de la corporación', () => {
  test('la primera vez se siembran del fichero, y se leen sin sesión', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.configuracion.deleteMany({ where: { key: CLAVE } });
    CorporacionService.olvidar();
    const res = await pedir('/corporacion');
    assert.equal(res.status, 200);
    assert.deepEqual(res.cuerpo, contactoDelFichero());
    assert.ok(await db.configuracion.findUnique({ where: { key: CLAVE } }), 'no se guardó la siembra');
  });

  test('solo Secretaría y Administración los cambian', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('/cms/corporacion', { metodo: 'PUT', cuerpo: NUEVOS })).status, 401);
    assert.equal((await pedir('/cms/corporacion', { rol: 'REDES', metodo: 'PUT', cuerpo: NUEVOS })).status, 403);
    assert.equal((await pedir('/cms/corporacion', { rol: 'ADMIN', metodo: 'PUT', cuerpo: NUEVOS })).status, 200);
  });

  test('guardar deja los vacíos a null, audita y llega a los correos sin reiniciar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await pedir('/cms/corporacion', { rol: 'SECRETARIA', metodo: 'PUT', cuerpo: NUEVOS });
    assert.equal(res.status, 200);
    assert.equal(res.cuerpo.redes.x, null);
    assert.equal(res.cuerpo.privacidad.emailDerechos, null);
    assert.deepEqual((await pedir('/corporacion')).cuerpo, res.cuerpo);
    // Lo que firman los correos y los PDF, ya cambiado.
    assert.equal(secretaria.email, 'secretaria@prueba.example');
    assert.deepEqual(lineasDeSecretaria(), ['Lunes, de 19:00 a 20:00', 'C. de la Prueba, 7, 41001 Villaprueba', '600 11 22 33']);
    const auditoria = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.CORPORACION_ACTUALIZAR, userId: usuarios.SECRETARIA }, orderBy: { id: 'desc' } });
    assert.ok(auditoria, 'no quedó en la auditoría');
  });

  test('un correo o una red mal puestos son 400 y no cambian nada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = (await pedir('/corporacion')).cuerpo;
    const malCorreo = await pedir('/cms/corporacion', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...NUEVOS, secretaria: { ...NUEVOS.secretaria, email: 'sin-arroba' } } });
    assert.equal(malCorreo.status, 400);
    const malaRed = await pedir('/cms/corporacion', { rol: 'ADMIN', metodo: 'PUT', cuerpo: { ...NUEVOS, redes: { ...NUEVOS.redes, facebook: 'facebook.com/prueba' } } });
    assert.equal(malaRed.status, 400);
    assert.deepEqual((await pedir('/corporacion')).cuerpo, antes);
  });
});

// WP11: el teléfono se guarda sin el +34, que la web antepone en los datos
// estructurados; escrito con él, salía «+34 +34 952…».
describe('el teléfono de Secretaría', () => {
  const telefonoDe = (telefono: string | null) => {
    const r = corporacionSchema({
      body: {
        secretaria: { horario: null, telefono, email: null },
        sede: { nombre: null, calle: null, codigoPostal: null, localidad: null },
        redes: { facebook: null, instagram: null, x: null, tiktok: null, youtube: null },
        privacidad: { emailDerechos: null },
      },
    });
    return r instanceof ArkErrors ? r : r.body.secretaria.telefono;
  };

  test('se guarda sin el prefijo de España, escrito como se escriba', () => {
    assert.equal(telefonoDe('+34 952 123 456'), '952 123 456');
    assert.equal(telefonoDe('0034-952123456'), '952123456');
    assert.equal(telefonoDe('+34952123456'), '952123456');
    assert.equal(telefonoDe(' 952 12 34 56 '), '952 12 34 56');
    assert.equal(telefonoDe(''), null);
    assert.equal(telefonoDe(null), null);
  });

  test('uno de fuera conserva su prefijo; lo que no es un teléfono, no pasa', () => {
    assert.equal(telefonoDe('+351 21 123 4567'), '+351 21 123 4567');
    assert.ok(telefonoDe('llamar por la tarde') instanceof ArkErrors);
    assert.ok(telefonoDe('12') instanceof ArkErrors);
    assert.ok(telefonoDe('952 123 456 <b>') instanceof ArkErrors);
  });
});
