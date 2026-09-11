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
import { contactSchema } from '../src/schemas/contact.schema.js';
import { motivoDescarte, MIN_MS_RELLENO } from '../src/controllers/contact.controller.js';
import { EmailService } from '../src/services/email.service.js';

const valido = { nombre: 'Ana', email: 'ana@example.es', asunto: 'Besapiés', mensaje: 'Quería preguntar por el horario.' };
const validar = (cambios: Record<string, unknown>) => contactSchema({ body: { ...valido, ...cambios } });
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

after(() => { server.close(); });

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

interface Enviado { from: string; to: string; subject: string; html: string; replyTo?: string }

function transporteFalso() {
  const enviados: Enviado[] = [];
  return { enviados, sendMail: async (opciones: Enviado) => { enviados.push(opciones); return {}; } };
}

describe('EmailService', () => {
  const internos = EmailService as unknown as { transporter: unknown; cuentaContacto: unknown };
  const transporterOriginal = internos.transporter;
  const entorno = { EMAIL_USER: process.env.EMAIL_USER, CONTACT_EMAIL_USER: process.env.CONTACT_EMAIL_USER, CONTACT_EMAIL_PASS: process.env.CONTACT_EMAIL_PASS, CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO };

  afterEach(() => {
    internos.transporter = transporterOriginal;
    internos.cuentaContacto = undefined;
    for (const [clave, valor] of Object.entries(entorno)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  });

  test('los asuntos llevan el nombre tal cual y el cuerpo lo lleva escapado', async () => {
    const general = transporteFalso();
    internos.transporter = general;
    process.env.EMAIL_USER = 'secretaria@example.es';

    await EmailService.enviarConfirmacionRegistro('hermano@example.es', "Seán O'Brien <b>");
    await EmailService.enviarPapeleta('hermano@example.es', "Seán O'Brien", {
      year: 2027, importe: '25,00 €', concepto: 'Papeleta', fechaSalida: 'Jueves Santo', horaSalida: '19:30h', accesoPuerta: 'Puerta principal',
    });

    const [registro, papeleta] = general.enviados;
    assert.equal(registro.subject, "📋 Solicitud de Registro Recibida - Seán O'Brien <b>");
    assert.match(registro.html, /Seán O&#39;Brien &lt;b&gt;/);
    assert.doesNotMatch(registro.html, /O'Brien <b>/);
    assert.equal(papeleta.subject, "📜 Papeleta de Sitio 2027 - Seán O'Brien");
  });

  test('con CONTACT_EMAIL_USER y CONTACT_EMAIL_PASS, el contacto sale por su propia cuenta', async () => {
    const general = transporteFalso();
    const contacto = transporteFalso();
    internos.transporter = general;
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
    internos.transporter = general;
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
