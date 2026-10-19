// Las plantillas de correo contra MariaDB: solo Secretaría y el Hermano Mayor
// las tocan; una plantilla no se guarda con huecos; puesta en uso, el correo
// sale con ella (y con el original si se quita); la que está en uso no se
// borra; las libres no se ponen en uso y llegan al editor del boletín en HTML;
// cada guardado deja una versión, y las de antes del editor por piezas se leen
// de su texto.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Prisma, Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { PlantillasCorreoService } from '../src/services/plantillas-correo.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';
import { identidad } from '../src/domain/datos-entidad.js';
import type { Pieza } from '../src/domain/plantillas-correo.js';

const texto = (t: string): Pieza => ({ tipo: 'parrafo', trozos: [{ texto: t }] });

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
  const previas = await db.plantillaCorreo.findMany({ where: { uso: { in: ['pesame', 'libre'] } }, include: { versiones: true } });
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const cab = (id: number, rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}`, 'Content-Type': 'application/json' });
  const s = cab(secretaria.id, Role.SECRETARIA);
  try {
    await db.plantillaCorreo.deleteMany({ where: { uso: { in: ['pesame', 'libre'] } } });
    assert.equal((await fetch(`${baseUrl}/api/plantillas-correo`, { headers: cab(tesorero.id, Role.TESORERIA) })).status, 403, 'Tesorería no toca los correos');

    const nueva = {
      nombre: 'Pésame breve', uso: 'pesame', asunto: 'Con ustedes, por {{difunto}}', resumen: '', titulo: 'En memoria',
      contenido: [{ tipo: 'parrafo', trozos: [{ texto: 'Rezamos por ' }, { texto: '{{difunto}}', negrita: true }, { texto: '.' }] }] as Pieza[],
      despedida: 'Descanse en paz.',
    };
    const mala = await fetch(`${baseUrl}/api/plantillas-correo`, { method: 'POST', headers: s, body: JSON.stringify({ ...nueva, contenido: [texto('Rezamos por {{difunta}}.')] }) });
    assert.equal(mala.status, 400);
    assert.match((await mala.json()).error, /no tiene el dato «difunta»/);
    const peligrosa = await fetch(`${baseUrl}/api/plantillas-correo`, { method: 'POST', headers: s, body: JSON.stringify({ ...nueva, contenido: [...nueva.contenido, { tipo: 'boton', texto: 'Pulsa', enlace: 'javascript:alert(1)' }] }) });
    assert.equal(peligrosa.status, 400, 'un botón a javascript: no se guarda');
    const deForma = await fetch(`${baseUrl}/api/plantillas-correo`, { method: 'POST', headers: s, body: JSON.stringify({ ...nueva, contenido: [{ tipo: 'html', html: '<script></script>' }] }) });
    assert.equal(deForma.status, 400, 'una pieza que no es de la paleta no pasa del esquema');

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
    const previa = await (await fetch(`${baseUrl}/api/plantillas-correo/vista-previa`, { method: 'POST', headers: s, body: JSON.stringify({ uso: 'sufragio', asunto: '{{que}}', resumen: '', titulo: 'x', contenido: [{ tipo: 'fijo', clave: 'cuando' }], despedida: '' }) })).json();
    assert.equal(previa.asunto, 'Misa');
    assert.match(previa.html, /lo pone la web/);
    assert.deepEqual(previa.problemas, []);

    // Las libres: no se ponen en uso, y el boletín las recibe en HTML.
    await PlantillasCorreoService.crear({
      nombre: 'Convocatoria de cabildo', uso: 'libre', asunto: 'Cabildo general', resumen: '', titulo: '', despedida: '',
      contenido: [
        { tipo: 'parrafo', trozos: [{ texto: 'Se convoca a los hermanos del ' }, { texto: '{{grupo}}', negrita: true }, { texto: '.' }] },
        { tipo: 'lista', elementos: [[{ texto: 'Orden del día' }]] },
      ],
    }, { userId: secretaria.id });
    assert.equal((await fetch(`${baseUrl}/api/plantillas-correo/usar`, { method: 'POST', headers: s, body: JSON.stringify({ uso: 'libre', id: otra.id }) })).status, 400);
    const libres = await (await fetch(`${baseUrl}/api/plantillas-correo/libres`, { headers: s })).json();
    assert.ok(libres[0].cuerpo.startsWith(`<p>Se convoca a los hermanos del <strong>${identidad.nombre}`), libres[0].cuerpo);
    assert.match(libres[0].cuerpo, /<ul><li><p>Orden del día<\/p><\/li><\/ul>$/);
  } finally {
    await db.plantillaCorreo.deleteMany({ where: { uso: { in: ['pesame', 'libre'] } } });
    for (const { versiones, contenido, ...p } of previas) {
      await db.plantillaCorreo.create({
        data: {
          ...p, contenido: contenido ?? Prisma.DbNull,
          versiones: { create: versiones.map(({ id: _id, plantillaId: _plantilla, datos, ...v }) => ({ ...v, datos: datos as Prisma.InputJsonValue })) },
        },
      });
    }
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

test('las plantillas de antes se leen de su texto, y cada guardado deja una versión a la que volver', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  // Como quedó guardada antes del editor por piezas: el cuerpo en texto y sin `contenido`.
  const vieja = await db.plantillaCorreo.create({
    data: { nombre: 'Pésame de antes', uso: 'pesame', asunto: 'Por {{difunto}}', titulo: 'En memoria', cuerpo: 'Rezamos por **{{difunto}}**.\n\n- Misa\n- Rosario', despedida: '' },
  });
  try {
    const leida = await PlantillasCorreoService.obtener(vieja.id);
    assert.deepEqual(leida.contenido, [
      { tipo: 'parrafo', trozos: [{ texto: 'Rezamos por ' }, { texto: '{{difunto}}', negrita: true }, { texto: '.' }] },
      { tipo: 'lista', elementos: [[{ texto: 'Misa' }], [{ texto: 'Rosario' }]] },
    ]);

    const nueva = { ...leida, nombre: 'Pésame de antes', resumen: 'Rezamos por él', contenido: [...leida.contenido, { tipo: 'separador' } as Pieza] };
    await PlantillasCorreoService.actualizar(vieja.id, nueva, { userId: secretaria.id });
    const fila = await db.plantillaCorreo.findUniqueOrThrow({ where: { id: vieja.id } });
    assert.equal(fila.cuerpo, '', 'guardada, pasa a piezas');
    assert.equal(fila.resumen, 'Rezamos por él');

    // La primera vez estrena el historial con cómo era y cómo queda.
    const versiones = await PlantillasCorreoService.versiones(vieja.id);
    assert.equal(versiones.length, 2);
    assert.equal(versiones[0].datos.contenido.length, 3);
    assert.equal(versiones[1].datos.contenido.length, 2);

    const fotoAjena = { tipo: 'foto', src: 'https://otra.web/foto.jpg', alt: '', pie: '' } as Pieza;
    await assert.rejects(PlantillasCorreoService.actualizar(vieja.id, { ...nueva, contenido: [...nueva.contenido, fotoAjena] }, { userId: secretaria.id }), /foto sin subir/);
  } finally {
    await db.plantillaCorreo.delete({ where: { id: vieja.id } });
    await db.auditLog.deleteMany({ where: { userId: secretaria.id } });
    await borrarUsuarioPrueba(secretaria.id);
  }
});
