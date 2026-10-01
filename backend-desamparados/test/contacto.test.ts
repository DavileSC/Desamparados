// test/contacto.test.ts
//
// C6: el formulario de contacto.
//  - Campo trampa y tiempo mínimo: al robot se le responde como si hubiera ido
//    bien, pero no se envía nada (ni se gasta la cuota de la cuenta de correo).
//  - Cuenta de envío propia (CONTACT_EMAIL_USER/PASS) con respaldo a EMAIL_*.
//  - Teléfono opcional con formato internacional.
//  - El email del visitante va al Reply-To: sin comas, espacios ni <>.
//  - Los asuntos de los correos van sin escapar para HTML («O'Brien»).
//
// Ninguna prueba envía correo de verdad: se sustituye el transporte.

import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { ArkErrors } from 'arktype';
import nodemailer from 'nodemailer';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { contactoSchema } from '../src/schemas/contacto.schema.js';
import { motivoDescarte, MIN_MS_RELLENO } from '../src/domain/senales-de-robot.js';
import { EmailService } from '../src/services/email.service.js';
import { ponerCuentaDeContacto, ponerTransporte } from '../src/services/correos/envio.js';

const valido = { nombre: 'Ana', email: 'ana@example.es', asunto: 'Besapiés', mensaje: 'Quería preguntar por el horario.' };
const validar = (cambios: Record<string, unknown>) => contactoSchema({ body: { ...valido, ...cambios } });
const esError = (resultado: unknown) => resultado instanceof ArkErrors;

describe('validación del formulario', () => {
  test('el teléfono es opcional y admite formato internacional', () => {
    for (const telefono of [undefined, '', '600123456', '+34 600 12 34 56', '+44 (0) 20 7946 0958', '951-234-567', '0034.951.234.567']) {
      assert.ok(!esError(validar(telefono === undefined ? {} : { telefono })), `debería aceptar ${telefono}`);
    }
    for (const telefono of ['123', 'no tengo', '+34 600 123 456 789 012 345', '600<b>', '++34600123456']) {
      assert.ok(esError(validar({ telefono })), `debería rechazar ${telefono}`);
    }
  });

  test('el email no admite lo que nodemailer leería como otra dirección en el Reply-To', () => {
    for (const email of ['"x"<ana@example.es>', 'ana,otro@example.es', 'ana@example.es,otro@example.es', 'ana@example.es;otro@example.es', 'ana maria@example.es', '<ana@example.es>', 'ana@example']) {
      assert.ok(esError(validar({ email })), `debería rechazar ${email}`);
    }
    for (const email of ["o'brien@example.ie", 'nombre.apellido+grupo@gmail.com', 'ana@sub.dominio-parroquia.es']) {
      assert.ok(!esError(validar({ email })), `debería aceptar ${email}`);
    }
  });
});

describe('señales de robot', () => {
  test('campo trampa relleno o demasiado rápido: descartado', () => {
    assert.ok(motivoDescarte({ comentarioAdicional: 'https://spam.example', tiempoRelleno: 60_000 }));
    assert.ok(motivoDescarte({ tiempoRelleno: MIN_MS_RELLENO - 1 }));
    assert.equal(motivoDescarte({ comentarioAdicional: '', tiempoRelleno: MIN_MS_RELLENO }), null);
    assert.equal(motivoDescarte({ tiempoRelleno: 45_000 }), null);
  });

  test('sin tiempo de relleno NO se descarta: es la web antigua en caché durante un despliegue', () => {
    assert.equal(motivoDescarte({ comentarioAdicional: '', tiempoRelleno: undefined }), null);
    assert.equal(motivoDescarte({}), null);
  });
});

// =================================================================
//  Contra el servidor (sin base de datos: /api/contact no la usa)
// =================================================================

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

// Los correos leen de la base su plantilla en uso: sin cerrar la conexión, el proceso no termina.
after(async () => { server.close(); await db.$disconnect(); });

afterEach(() => { mock.restoreAll(); });

// El limitador de contacto deja 5 envíos por IP cada 15 minutos: estas pruebas
// hacen 5, las justas.
const enviar = (cuerpo: Record<string, unknown>) =>
  fetch(`${baseUrl}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

describe('POST /api/contact', () => {
  test('con el campo trampa relleno responde 200 y no envía nada', async () => {
    const envio = mock.method(EmailService, 'enviarContacto', async () => true);
    const res = await enviar({ ...valido, comentarioAdicional: 'https://spam.example', tiempoRelleno: 20_000 });
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { message: string }).message, 'Mensaje enviado correctamente.');
    assert.equal(envio.mock.callCount(), 0);
  });

  test('rellenado en menos de 3 segundos responde 200 y no envía nada', async () => {
    const envio = mock.method(EmailService, 'enviarContacto', async () => true);
    const res = await enviar({ ...valido, comentarioAdicional: '', tiempoRelleno: 800 });
    assert.equal(res.status, 200);
    assert.equal(envio.mock.callCount(), 0);
  });

  test('una persona sí envía, y sin las señales antispam en los datos del correo', async () => {
    const envio = mock.method(EmailService, 'enviarContacto', async () => true);
    const res = await enviar({ ...valido, telefono: '', comentarioAdicional: '', tiempoRelleno: 25_000 });
    assert.equal(res.status, 200);
    assert.equal(envio.mock.callCount(), 1);
    assert.deepEqual(envio.mock.calls[0].arguments[0], { ...valido, telefono: '' });
  });

  test('sin tiempo de relleno (la web antigua) se envía igual y queda anotado en el log', async () => {
    const envio = mock.method(EmailService, 'enviarContacto', async () => true);
    const aviso = mock.method(console, 'warn', () => {});
    const res = await enviar({ ...valido, telefono: '' });
    assert.equal(res.status, 200);
    assert.equal(envio.mock.callCount(), 1);
    assert.ok(aviso.mock.calls.some((c) => String(c.arguments[0]).includes('sin tiempo de relleno')));
  });

  test('un email con ángulos se rechaza con 400', async () => {
    const envio = mock.method(EmailService, 'enviarContacto', async () => true);
    const res = await enviar({ ...valido, email: '"x"<ana@example.es>', tiempoRelleno: 25_000 });
    assert.equal(res.status, 400);
    assert.equal(envio.mock.callCount(), 0);
  });
});

// =================================================================
//  El correo que sale
// =================================================================

interface Enviado { from: string; to: string; subject: string; html: string; text?: string; replyTo?: string; attachments?: ({ cid: string } | { filename: string; content: Buffer })[] }

function transporteFalso() {
  const enviados: Enviado[] = [];
  return { enviados, sendMail: async (opciones: Enviado) => { enviados.push(opciones); return {}; } };
}

describe('EmailService', () => {
  const entorno = { EMAIL_USER: process.env.EMAIL_USER, CONTACT_EMAIL_USER: process.env.CONTACT_EMAIL_USER, CONTACT_EMAIL_PASS: process.env.CONTACT_EMAIL_PASS, CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO };

  afterEach(() => {
    ponerTransporte(undefined);
    ponerCuentaDeContacto(undefined);
    for (const [clave, valor] of Object.entries(entorno)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  });

  test('los asuntos llevan el nombre tal cual y el cuerpo lo lleva escapado', async () => {
    const general = transporteFalso();
    ponerTransporte(general);
    process.env.EMAIL_USER = 'secretaria@example.es';

    await EmailService.enviarConfirmacionRegistro('hermano@example.es', "Seán O'Brien <b>");
    await EmailService.enviarPapeleta('hermano@example.es', "Seán O'Brien", {
      year: 2027, salida: { nombre: 'Sábado de Pasión', cobro: 'CUOTA', conRopa: true, indicaciones: null, articulo: 'el' }, importe: '25,00 €', concepto: 'Papeleta', fechaSalida: 'Jueves Santo', horaSalida: '19:30h', accesoPuerta: 'Puerta principal',
    });

    const [registro, papeleta] = general.enviados;
    assert.equal(registro.subject, 'Hemos recibido su solicitud de ingreso');
    assert.match(registro.html, /Seán O&#39;Brien &lt;b&gt;/);
    assert.doesNotMatch(registro.html, /O'Brien <b>/);
    assert.equal(papeleta.subject, "Papeleta del Sábado de Pasión 2027: Seán O'Brien");
  });

  test('el asunto de la papeleta lleva el artículo de la salida, no siempre «del»', async () => {
    const general = transporteFalso();
    ponerTransporte(general);
    process.env.EMAIL_USER = 'secretaria@example.es';

    await EmailService.enviarPapeleta('hermano@example.es', 'Ana', {
      year: 2027, salida: { nombre: 'Procesión Magna', cobro: 'CUOTA', conRopa: true, indicaciones: null, articulo: 'la' }, importe: '25,00 €', concepto: 'Papeleta', fechaSalida: 'Jueves Santo', horaSalida: '19:30h', accesoPuerta: 'Puerta principal',
    });

    assert.match(general.enviados[0].subject, /^Papeleta de la Procesión Magna/);
  });

  test('las indicaciones de la salida conservan sus saltos de línea en los correos', async () => {
    const general = transporteFalso();
    ponerTransporte(general);
    process.env.EMAIL_USER = 'secretaria@example.es';
    const salida = { nombre: 'Rosario vespertino', cobro: 'DONATIVO' as const, conRopa: false, indicaciones: 'Puntualidad.\nMedalla <b>visible</b>.', articulo: 'el' as const };

    await EmailService.enviarPapeleta('hermano@example.es', 'Ana', {
      year: 2027, salida, importe: '', concepto: 'Papeleta', fechaSalida: 'sábado, 16 de octubre', horaSalida: '18:30h', accesoPuerta: 'Parroquia',
    });
    await EmailService.enviarAperturaPapeletas('hermano@example.es', 'Ana', ['Ana'], ['lunes, 4 de octubre'], 2027, 'MUJER', salida);

    for (const correo of general.enviados) {
      assert.match(correo.html, /Puntualidad\.<br>Medalla &lt;b&gt;visible&lt;\/b&gt;\./, correo.subject);
    }
  });

  test('el recordatorio de ausencia nombra su salida y no habla de Estación de Penitencia', async () => {
    const general = transporteFalso();
    ponerTransporte(general);
    process.env.EMAIL_USER = 'secretaria@example.es';

    await EmailService.enviarRecordatorioAusencia('hermano@example.es', 'Ana', 'lunes, 4 de octubre', { nombre: 'Rosario vespertino', articulo: 'el' }, 'MUJER');

    const [correo] = general.enviados;
    assert.doesNotMatch(correo.html, /Estación de Penitencia|papeleta de sitio/);
    assert.doesNotMatch(correo.subject, /papeleta de sitio/);
    assert.match(correo.html, /papeleta del Rosario vespertino/);
  });

  test('el escudo y la Virgen van dentro del correo; los avisos internos, solo con el escudo', async () => {
    const general = transporteFalso();
    ponerTransporte(general);
    process.env.EMAIL_USER = 'secretaria@example.es';

    await EmailService.enviarConfirmacionRegistro('hermano@example.es', 'Ana', { sexo: 'MUJER' });
    await EmailService.enviarAvisoSolicitud({ nombre: 'Ana', email: 'ana@example.es' });

    const [alHermano, interno] = general.enviados;
    const cids = (c: Enviado) => (c.attachments ?? []).flatMap((a) => ('cid' in a ? [a.cid] : [])).sort();
    assert.deepEqual(cids(alHermano), ['escudo@desamparados', 'virgen@desamparados']);
    assert.match(alHermano.html, /src="cid:virgen@desamparados"/);
    assert.deepEqual(cids(interno), ['escudo@desamparados']);
  });

  test('cada correo lleva también su versión en texto, sin etiquetas y con el nombre tal cual', async () => {
    const general = transporteFalso();
    ponerTransporte(general);
    process.env.EMAIL_USER = 'secretaria@example.es';

    await EmailService.enviarRecuperacionContrasena('hermano@example.es', "Seán O'Brien", 'abc', { sexo: 'HOMBRE' });

    const [correo] = general.enviados;
    assert.ok(correo.text, 'sin versión en texto, los filtros de spam desconfían');
    assert.doesNotMatch(correo.text!, /<[a-z/]/i);
    assert.match(correo.text!, /Estimado Seán O'Brien:/);
    assert.match(correo.text!, /reset-password\?token=abc/, 'el enlace tiene que poder copiarse');
    assert.doesNotMatch(correo.text!, /Para completar/, 'el resumen oculto de la bandeja no va en el texto');
  });

  test('con CONTACT_EMAIL_USER y CONTACT_EMAIL_PASS, el contacto sale por su propia cuenta', async () => {
    const general = transporteFalso();
    const contacto = transporteFalso();
    ponerTransporte(general);
    const crear = mock.method(nodemailer, 'createTransport', () => contacto);
    process.env.EMAIL_USER = 'secretaria@example.es';
    process.env.CONTACT_EMAIL_USER = 'contacto@example.es';
    process.env.CONTACT_EMAIL_PASS = 'clave-de-aplicacion';
    process.env.CONTACT_EMAIL_TO = 'buzon@example.es';

    assert.equal(await EmailService.enviarContacto({ ...valido, telefono: '' }), true);

    assert.equal(general.enviados.length, 0, 'la cuenta de las contraseñas no gasta cuota en el contacto');
    assert.equal(contacto.enviados.length, 1);
    const [correo] = contacto.enviados;
    assert.match(correo.from, /<contacto@example\.es>$/);
    assert.equal(correo.to, 'buzon@example.es');
    assert.equal(correo.replyTo, valido.email);
    assert.match(correo.html, /No indicado/);
    assert.deepEqual(crear.mock.calls[0].arguments[0], { service: 'gmail', auth: { user: 'contacto@example.es', pass: 'clave-de-aplicacion' } });
  });

  test('sin cuenta propia (o a medias), el contacto sale por EMAIL_USER como antes', async () => {
    const general = transporteFalso();
    ponerTransporte(general);
    const crear = mock.method(nodemailer, 'createTransport', () => transporteFalso());
    const aviso = mock.method(console, 'warn', () => {});
    process.env.EMAIL_USER = 'secretaria@example.es';
    delete process.env.CONTACT_EMAIL_TO;
    process.env.CONTACT_EMAIL_USER = 'contacto@example.es';
    delete process.env.CONTACT_EMAIL_PASS;

    assert.equal(await EmailService.enviarContacto({ ...valido, telefono: '+34 600 12 34 56' }), true);
    assert.equal(crear.mock.callCount(), 0);
    assert.equal(general.enviados.length, 1);
    assert.match(general.enviados[0].from, /<secretaria@example\.es>$/);
    assert.match(general.enviados[0].html, /\+34 600 12 34 56/);
    assert.ok(aviso.mock.calls.some((c) => String(c.arguments[0]).includes('CONTACT_EMAIL_PASS')));
  });
});
