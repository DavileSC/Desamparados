// La papeleta de sitio en PDF (octubre de 2026): la que se imprime en la mesa
// al dar la ropa, la que va adjunta al correo y el QR de la tarjeta que el
// hermano enseña desde el móvil. Los tres llevan el mismo código firmado.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { leerCodigoDePapeleta } from '../src/domain/papeleta-qr.js';
import { datosDeLaPapeleta, papeletaEnPdf } from '../src/services/procesion/papeleta-pdf.js';
import { MiProcesionService } from '../src/services/procesion/mi-procesion.service.js';
import { PlazoPapeletasService } from '../src/services/procesion/plazo.service.js';
import { ZonasService } from '../src/services/procesion/zonas.service.js';
import { ponerTransporte, type TransporteDeCorreo } from '../src/services/correos/envio.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { PASION, salida } from './fixtures/salidas.js';

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
  ponerTransporte(undefined);
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

/** Un hermano con su papeleta de la Pasión recogida, del año que ve el área. Todo se borra al terminar. */
async function escenario() {
  const usuario = await crearUsuarioPrueba(Role.USER);
  const marca = Date.now().toString(36);
  const pasion = await salida(PASION);
  const year = PlazoPapeletasService.anioDeLaProcesion(pasion);
  const hermano = await db.hermano.create({
    data: { userId: usuario.id, nombre: 'Jesús', apellidos: `Papeleta${marca} Ruiz`, sexo: 'HOMBRE', email: `papeleta-${marca}@example.com`, fechaNacimiento: new Date(Date.UTC(1985, 3, 9)), activo: true, esTitular: true },
  });
  const recibo = await db.recibo.create({
    data: { hermanoId: hermano.id, year, concepto: `Papeleta de sitio ${year}`, importe: 20, tipo: 'PAPELETA_SITIO', estado: 'PAGADO', metodoPago: 'EFECTIVO', fechaPago: new Date() },
  });
  const papeleta = await db.papeletaSitio.create({
    data: { hermanoId: hermano.id, year, salidaId: pasion.id, puesto: 'Nazareno', tramo: 'Tramo 2 · Cristo', numTunicaAsignada: '145-31', numCapiroteAsignado: '150', reciboId: recibo.id },
  });
  const recoger = async () => {
    await db.papeletaSitio.deleteMany({ where: { hermanoId: hermano.id } });
    await db.recibo.deleteMany({ where: { hermanoId: hermano.id } });
    await db.hermano.delete({ where: { id: hermano.id } });
    await borrarUsuarioPrueba(usuario.id);
  };
  return { usuario, hermano, papeleta, year, recoger };
}

test('el PDF de la papeleta: una página A4 con sus datos y el QR firmado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const d = await datosDeLaPapeleta(e.papeleta.id);
    assert.ok(d);
    assert.equal(d.referencia, `${e.year}-${String(e.papeleta.id).padStart(4, '0')}`);
    assert.equal(d.importe, '20,00 €');
    assert.equal(d.tunica, '145-31');
    assert.equal(leerCodigoDePapeleta(d.codigo), e.papeleta.id, 'el QR es el de esta papeleta');

    const pdf = await papeletaEnPdf(d);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length, 1, 'una sola página');
    assert.equal(await datosDeLaPapeleta(999999999), null);
  } finally {
    await e.recoger();
  }
});

test('por HTTP: la imprime la mesa; un hermano no, ni sin sesión', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const albacea = await crearUsuarioPrueba(Role.ALBACERIA);
  try {
    const ruta = `${baseUrl}/api/procesion/admin/papeletas/${e.papeleta.id}/pdf`;
    const como = (userId: number, rol: Role, url = ruta) => fetch(url, { headers: { Cookie: `${COOKIE_CMS}=${generateToken(userId, rol)}` } });

    assert.equal((await fetch(ruta)).status, 401);
    assert.equal((await como(e.usuario.id, Role.USER)).status, 403);
    const bien = await como(albacea.id, Role.ALBACERIA);
    assert.equal(bien.status, 200);
    assert.equal(bien.headers.get('content-type'), 'application/pdf');
    assert.match(bien.headers.get('content-disposition') ?? '', new RegExp(`^inline; filename="papeleta-${e.year}-\\d{4}\\.pdf"$`));
    assert.equal(bien.headers.get('cache-control'), 'private, no-store');
    assert.equal(Buffer.from(await bien.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await como(albacea.id, Role.ALBACERIA, `${baseUrl}/api/procesion/admin/papeletas/999999999/pdf`)).status, 404);
  } finally {
    await borrarUsuarioPrueba(albacea.id);
    await e.recoger();
  }
});

test('el correo de la papeleta lleva el PDF adjunto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  const enviados: Parameters<TransporteDeCorreo['sendMail']>[0][] = [];
  ponerTransporte({ sendMail: async (c) => { enviados.push(c); return {}; } });
  try {
    await ZonasService.mandarPapeleta(e.papeleta.id);
    // El correo no se espera (la mesa no se para por él): se espera aquí a que salga.
    for (let i = 0; i < 50 && enviados.length === 0; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(enviados.length, 1);
    const adjunto = (enviados[0].attachments ?? []).find((a) => 'content' in a);
    assert.ok(adjunto && 'content' in adjunto, 'lleva un archivo adjunto');
    assert.match(adjunto.filename, /^papeleta-\d{4}-\d{4}\.pdf$/);
    assert.equal(adjunto.contentType, 'application/pdf');
    assert.equal(adjunto.content.subarray(0, 5).toString(), '%PDF-');
    assert.match(enviados[0].html, /Le adjuntamos su papeleta en PDF/);
  } finally {
    ponerTransporte(undefined);
    await e.recoger();
  }
});

test('en el área, la papeleta de este año trae su QR para enseñarlo desde el móvil', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const e = await escenario();
  try {
    const estado = await MiProcesionService.getMiEstado(e.usuario.id);
    const ficha = estado.fichas.find((f) => f.id === e.hermano.id)!;
    const papeleta = ficha.porSalida[PASION].papeleta;
    assert.ok(papeleta?.qr, 'con la papeleta recogida, hay QR');
    assert.equal(leerCodigoDePapeleta(papeleta.qr.codigo), e.papeleta.id);
    assert.match(papeleta.qr.svg, /^<svg[\s\S]*<\/svg>\s*$/);
    assert.equal(papeleta.tunica, '145-31');
    assert.ok(estado.salidas.find((s) => s.salida === PASION)?.evento.horaSalida, 'la hora de entrada va con la salida');
  } finally {
    await e.recoger();
  }
});
