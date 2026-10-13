// Las plantillas de correo contra MariaDB: solo Secretaría y el Hermano Mayor
// las tocan; una plantilla no se guarda con huecos; puesta en uso, el correo
// sale con ella (y con el original si se quita); la que está en uso no se
// borra; las libres no se ponen en uso y llegan al editor del boletín en HTML.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { PlantillasCorreoService } from '../src/services/plantillas-correo.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';
import { identidad } from '../src/domain/datos-entidad.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

test('crear, poner en uso, componer con ella, no borrar la que está en uso y volver al original', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Hay una sola en uso por correo: se guardan las de la base de desarrollo y se dejan como estaban.
  const previas = await db.plantillaCorreo.findMany({ where: { uso: { in: ['pesame', 'libre'] } } });
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const cab = (id: number, rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}`, 'Content-Type': 'application/json' });
  const s = cab(secretaria.id, Role.SECRETARIA);
  try {
    await db.plantillaCorreo.deleteMany({ where: { uso: { in: ['pesame', 'libre'] } } });
    assert.equal((await fetch(`${baseUrl}/api/plantillas-correo`, { headers: cab(tesorero.id, Role.TESORERIA) })).status, 403, 'Tesorería no toca los correos');

    const nueva = { nombre: 'Pésame breve', uso: 'pesame', asunto: 'Con ustedes, por {{difunto}}', titulo: 'En memoria', cuerpo: 'Rezamos por **{{difunto}}**.', despedida: 'Descanse en paz.' };
    const mala = await fetch(`${baseUrl}/api/plantillas-correo`, { method: 'POST', headers: s, body: JSON.stringify({ ...nueva, cuerpo: 'Rezamos por {{difunta}}.' }) });
    assert.equal(mala.status, 400);
    assert.match((await mala.json()).error, /no tiene el campo \{\{difunta\}\}/);

    const creada = await (await fetch(`${baseUrl}/api/plantillas-correo`, { method: 'POST', headers: s, body: JSON.stringify(nueva) })).json();
    assert.equal(creada.enUso, false);
    // Creada no es en uso: el pésame sigue saliendo con el original.
    assert.match((await PlantillasCorreoService.correo('pesame', { campos: { difunto: 'José', hermano: 'hermano' } })).html, /hermano de esta corporación/);

    const lista = await (await fetch(`${baseUrl}/api/plantillas-correo/usar`, { method: 'POST', headers: s, body: JSON.stringify({ uso: 'pesame', id: creada.id }) })).json();
    assert.equal(lista.usos.find((u: { clave: string }) => u.clave === 'pesame').plantillas[0].enUso, true);
    const correo = await PlantillasCorreoService.correo('pesame', { campos: { difunto: 'José', hermano: 'hermano' } });
    assert.equal(correo.asunto, 'Con ustedes, por José');
    assert.match(correo.html, /Rezamos por <strong>José<\/strong>\./);

    // Una segunda en uso quita la primera: una por correo.
    const otra = await PlantillasCorreoService.crear({ ...nueva, nombre: 'Otra' }, { userId: secretaria.id });
    await PlantillasCorreoService.usar('pesame', otra.id, { userId: secretaria.id });
    assert.equal(await db.plantillaCorreo.count({ where: { uso: 'pesame', enUso: true } }), 1);

    assert.equal((await fetch(`${baseUrl}/api/plantillas-correo/${otra.id}`, { method: 'DELETE', headers: s })).status, 409, 'la que está en uso no se borra');
    assert.equal((await fetch(`${baseUrl}/api/plantillas-correo/${creada.id}`, { method: 'DELETE', headers: s })).status, 200);

    await fetch(`${baseUrl}/api/plantillas-correo/usar`, { method: 'POST', headers: s, body: JSON.stringify({ uso: 'pesame', id: null }) });
    assert.equal(await db.plantillaCorreo.count({ where: { uso: 'pesame', enUso: true } }), 0);
    assert.match((await PlantillasCorreoService.correo('pesame', { campos: { difunto: 'José', hermano: 'hermano' } })).html, /hermano de esta corporación/);

    // Vista previa con ejemplos y los bloques como recuadros que dicen qué irá.
    const previa = await (await fetch(`${baseUrl}/api/plantillas-correo/vista-previa`, { method: 'POST', headers: s, body: JSON.stringify({ uso: 'sufragio', asunto: '{{que}}', titulo: 'x', cuerpo: '[[cuando]]', despedida: '' }) })).json();
    assert.equal(previa.asunto, 'Misa');
    assert.match(previa.html, /Aquí irá/);

    // Las libres: no se ponen en uso, y el boletín las recibe en HTML.
    await PlantillasCorreoService.crear({ nombre: 'Convocatoria de cabildo', uso: 'libre', asunto: 'Cabildo general', titulo: '', cuerpo: 'Se convoca a los hermanos del **{{grupo}}**.\n\n- Orden del día', despedida: '' }, { userId: secretaria.id });
    assert.equal((await fetch(`${baseUrl}/api/plantillas-correo/usar`, { method: 'POST', headers: s, body: JSON.stringify({ uso: 'libre', id: otra.id }) })).status, 400);
    const libres = await (await fetch(`${baseUrl}/api/plantillas-correo/libres`, { headers: s })).json();
    assert.ok(libres[0].cuerpo.startsWith(`<p>Se convoca a los hermanos del <strong>${identidad.nombre}`), libres[0].cuerpo);
    assert.match(libres[0].cuerpo, /<ul><li><p>Orden del día<\/p><\/li><\/ul>$/);
  } finally {
    await db.plantillaCorreo.deleteMany({ where: { uso: { in: ['pesame', 'libre'] } } });
    if (previas.length) await db.plantillaCorreo.createMany({ data: previas });
    await db.auditLog.deleteMany({ where: { userId: secretaria.id } });
    await borrarUsuarioPrueba(secretaria.id);
    await borrarUsuarioPrueba(tesorero.id);
  }
});

test('los ejemplos de los campos comunes son los de esta instalación, no los escritos en el catálogo', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  // Las pruebas corren con la instalación de ejemplo: «la Hermandad…».
  const { comunes } = await PlantillasCorreoService.listar();
  const ejemplo = (clave: string) => comunes.find((c) => c.clave === clave)?.ejemplo;
  assert.equal(ejemplo('grupo'), identidad.nombre);
  assert.equal(ejemplo('de_la_corporacion'), `de la ${identidad.tipo}`);
  assert.equal(ejemplo('nuestra_corporacion'), `nuestra ${identidad.tipo}`);
  assert.ok(comunes.every((c) => !/Grupo Parroquial/.test(c.ejemplo ?? '')));
});
