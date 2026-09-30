// El censo en Excel o CSV contra MariaDB: la exportación (sin datos bancarios,
// con o sin bajas, con rastro en la auditoría) y la importación en dos pasos:
// qué filas entran, quién recibe cuenta propia, qué número toma cada activo y
// que importar dos veces no duplique a nadie. Cada prueba recoge lo suyo.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import ExcelJS from 'exceljs';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { CensoHojaService, CUENTA_CENSO_IMPORTADO } from '../src/services/censo-hoja.service.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { escribirCsv, leerCsv } from '../src/domain/censo-hoja.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
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

const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
/** Un DNI con su letra bien puesta, distinto en cada llamada. */
let contador = 0;
const dniNuevo = () => {
  const n = 70_000_000 + ((Date.now() * 7 + process.pid * 13 + contador++ * 101) % 9_999_999);
  return `${n}${LETRAS[n % 23]}`;
};

async function escenario() {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const marca = `Importado${Date.now()}`;
  const recoger = async () => {
    const hermanos = await db.hermano.findMany({ where: { OR: [{ apellidos: { contains: marca } }, { nombre: { contains: marca } }] }, select: { id: true, userId: true } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos.map((h) => h.id) } } });
    const custodia = await db.user.findUnique({ where: { email: CUENTA_CENSO_IMPORTADO.email }, select: { id: true } });
    const propias = [...new Set(hermanos.map((h) => h.userId))].filter((id) => id !== custodia?.id);
    await db.user.deleteMany({ where: { id: { in: propias } } });
    // La cuenta de custodia solo se va si se ha quedado sin fichas.
    if (custodia && (await db.hermano.count({ where: { userId: custodia.id } })) === 0) await db.user.delete({ where: { id: custodia.id } });
    await db.auditLog.deleteMany({ where: { userId: staff.id } });
    await borrarUsuarioPrueba(staff.id);
  };
  return { staff, meta: { userId: staff.id }, marca, recoger };
}

const csv = (filas: (string | number | null)[][]) => Buffer.from(escribirCsv(filas), 'utf8');

test('importar: la vista previa separa lo bueno de lo malo, y al importar cada uno recibe su cuenta y su número', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const adulto = dniNuevo();
    const otro = dniNuevo();
    const correo = `${e.marca.toLowerCase()}@ejemplo.test`;
    const fichero = csv([
      ['Nombre', 'Apellidos', 'NIF', 'F. nacimiento', 'E-mail', 'F. alta', 'Fecha de baja', 'IBAN'],
      ['Ana', `${e.marca} Gil`, adulto, '15/03/1980', correo, '01/01/2001', '', 'ES91 2100 0418 4502 0005 1332'],
      ['Luisito', `${e.marca} Gil`, '', '10/10/2015', '', '01/01/2016', '', ''],
      ['Pepa', `${e.marca} Ruiz`, otro, '01/02/1950', '', '01/01/1990', '31/12/2020', ''],
      ['', 'Sin nombre', '', '01/01/1990', '', '', '', ''],
      ['Ana', `${e.marca} Gil`, adulto, '15/03/1980', '', '', '', ''],
    ]);

    const previa = await CensoHojaService.previa(fichero);
    assert.equal(previa.filas, 5);
    assert.equal(previa.importables, 3);
    assert.equal(previa.conCuenta, 1);
    assert.equal(previa.deBaja, 1);
    assert.equal(previa.sinNumero, 2);
    assert.equal(previa.domiciliadas, 1);
    assert.deepEqual(previa.errores.map((x) => x.fila), [5, 6]);
    // La vista previa no toca nada.
    assert.equal(await db.hermano.count({ where: { apellidos: { contains: e.marca } } }), 0);

    const { _max } = await db.hermano.aggregate({ _max: { numeroHermano: true } });
    const r = await CensoHojaService.importar(fichero, e.meta);
    assert.equal(r.importadas, 3);

    const ana = await db.hermano.findUniqueOrThrow({ where: { dni: adulto }, include: { user: true } });
    assert.equal(ana.esTitular, true);
    assert.equal(ana.user.email, correo);
    assert.equal(ana.formaPagoPref, 'DOMICILIACION');
    assert.equal(ana.iban, 'ES9121000418450200051332');
    assert.ok(ana.fechaMandato);
    const nino = await db.hermano.findFirstOrThrow({ where: { nombre: 'Luisito', apellidos: { contains: e.marca } }, include: { user: true } });
    assert.equal(nino.user.email, CUENTA_CENSO_IMPORTADO.email);
    assert.equal(nino.esTitular, false);
    // Los activos, a continuación del último y por antigüedad: Ana (2001) antes que el niño (2016).
    assert.deepEqual([ana.numeroHermano, nino.numeroHermano], [(_max.numeroHermano ?? 0) + 1, (_max.numeroHermano ?? 0) + 2]);
    const pepa = await db.hermano.findUniqueOrThrow({ where: { dni: otro } });
    assert.deepEqual([pepa.activo, pepa.numeroHermano], [false, null]);

    assert.ok(await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.CENSO_IMPORTAR, userId: e.staff.id } }));

    // Otra vez el mismo fichero: todos ya están, no se duplica nadie.
    await assert.rejects(CensoHojaService.importar(fichero, e.meta), (err: unknown) => err instanceof HttpError && err.status === 409);
    assert.equal(await db.hermano.count({ where: { apellidos: { contains: e.marca } } }), 3);
  } finally {
    await e.recoger();
  }
});

test('importar un Excel con las fechas como fechas y los títulos de la exportación', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Hoja1');
    hoja.addRow(['Número', 'Nombre', 'Primer apellido', 'Segundo apellido', 'Fecha de nacimiento', 'Fecha de alta']);
    hoja.addRow([null, 'Marta', e.marca, 'López', new Date('1975-06-01T00:00:00Z'), new Date('1999-04-01T00:00:00Z')]);
    const fichero = Buffer.from(await libro.xlsx.writeBuffer());

    const previa = await CensoHojaService.previa(fichero);
    assert.deepEqual(previa.errores, []);
    assert.equal(previa.importables, 1);
    await CensoHojaService.importar(fichero, e.meta);
    const marta = await db.hermano.findFirstOrThrow({ where: { apellidos: { contains: e.marca } } });
    assert.deepEqual([marta.primerApellido, marta.segundoApellido, marta.fechaNacimiento.toISOString().slice(0, 10)], [e.marca, 'López', '1975-06-01']);

    await assert.rejects(CensoHojaService.previa(Buffer.from('PK esto no es un zip')), (err: unknown) => err instanceof HttpError && /no se puede abrir/.test(err.message));
    await assert.rejects(CensoHojaService.previa(csv([['Foo', 'Bar'], ['1', '2']])), (err: unknown) => err instanceof HttpError && /columna del nombre/.test(err.message));
  } finally {
    await e.recoger();
  }
});

test('exportar: activos o todos, sin cuenta bancaria, y queda en la auditoría', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    await CensoHojaService.importar(csv([
      ['Nombre', 'Apellidos', 'Fecha de nacimiento', 'Fecha de alta', 'Fecha de baja', 'IBAN'],
      ['Activo', `${e.marca} Uno`, '01/01/1980', '01/01/2000', '', 'ES9121000418450200051332'],
      ['Bajado', `${e.marca} Dos`, '01/01/1980', '01/01/2000', '01/01/2010', ''],
    ]), e.meta);

    const activos = await CensoHojaService.exportar('csv', false, e.meta);
    const filasActivos = leerCsv(activos.contenido.toString('utf8'));
    assert.ok(!filasActivos[0].includes('IBAN'));
    assert.ok(filasActivos.some((f) => f.includes('Activo') && f.includes(e.marca)));
    assert.ok(!filasActivos.some((f) => f.includes('Bajado')));
    assert.ok(!activos.contenido.toString('utf8').includes('ES9121000418450200051332'));

    const todos = leerCsv((await CensoHojaService.exportar('csv', true, e.meta)).contenido.toString('utf8'));
    const bajado = todos.find((f) => f.includes('Bajado'))!;
    assert.equal(bajado[todos[0].indexOf('Estado')], 'De baja');
    assert.equal(bajado[todos[0].indexOf('Fecha de baja')], '2010-01-01');

    const xlsx = await CensoHojaService.exportar('xlsx', false, e.meta);
    assert.equal(xlsx.contenido.subarray(0, 2).toString('latin1'), 'PK');
    assert.match(xlsx.nombre, /^censo-activos-\d{4}-\d{2}-\d{2}\.xlsx$/);

    assert.equal(await db.auditLog.count({ where: { action: ACCIONES_AUDITORIA.CENSO_EXPORTAR, userId: e.staff.id } }), 3);
  } finally {
    await e.recoger();
  }
});

test('las rutas del censo en hoja piden sesión de gestión del censo', async (t) => {
  for (const [metodo, ruta] of [['GET', '/api/hermanos/admin/censo/exportar'], ['POST', '/api/hermanos/admin/censo/importar/previa'], ['POST', '/api/hermanos/admin/censo/importar']] as const) {
    assert.equal((await fetch(`${baseUrl}${ruta}`, { method: metodo })).status, 401, `${metodo} ${ruta}`);
  }
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  const tesoreria = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    const cookie = (id: number, rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}` });
    assert.equal((await fetch(`${baseUrl}/api/hermanos/admin/censo/exportar`, { headers: cookie(tesoreria.id, Role.TESORERIA) })).status, 403);

    const res = await fetch(`${baseUrl}/api/hermanos/admin/censo/exportar?formato=csv`, { headers: cookie(e.staff.id, Role.SECRETARIA) });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition') ?? '', /censo-activos-.*\.csv/);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');

    const formulario = new FormData();
    formulario.append('fichero', new Blob([csv([['Nombre', 'Apellidos', 'Fecha de nacimiento'], ['Rosa', `${e.marca} Sanz`, '01/01/1960']])]), 'censo.csv');
    const previa = await fetch(`${baseUrl}/api/hermanos/admin/censo/importar/previa`, { method: 'POST', headers: cookie(e.staff.id, Role.SECRETARIA), body: formulario });
    assert.equal(previa.status, 200);
    assert.equal((await previa.json() as { importables: number }).importables, 1);
  } finally {
    await borrarUsuarioPrueba(tesoreria.id);
    await e.recoger();
  }
});
