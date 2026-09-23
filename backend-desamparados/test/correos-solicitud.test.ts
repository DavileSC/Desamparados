// test/correos-solicitud.test.ts
//
// Los correos del expediente de alta de un hermano:
//  - Buzón de pruebas: sin credenciales y fuera de producción, el correo se
//    escribe en storage/correos en vez de intentar hablar con Gmail y fallar en
//    silencio. Es lo que permite revisarlos en local.
//  - Los datos de la entidad que no están confirmados NO se inventan: el bloque
//    entero desaparece del correo (mismo criterio que config/site.ts en la web).
//  - Aviso a Secretaría, aprobación y rechazo/baja.
//
// El primer import aísla storage/ en una carpeta temporal: estas pruebas
// escriben ficheros y nunca deben tocar los del repositorio.

import './fixtures/almacen-temporal.js';
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, mock, test } from 'node:test';
import nodemailer from 'nodemailer';
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { EmailService } from '../src/services/email.service.js';
import { buzonDePruebas, buzonPedido } from '../src/utils/buzon-pruebas.js';
import { ponerCuentaDeContacto, ponerTransporte } from '../src/services/correos/envio.js';
import db from '../src/config/db.js';
import { AuthService } from '../src/services/auth.service.js';
import { PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { RegistroService } from '../src/services/registro.service.js';
import { SolicitudesService } from '../src/services/solicitudes.service.js';
import { CensoService } from '../src/services/censo.service.js';

const carpetaCorreos = () => path.join(process.cwd(), 'storage', 'correos');

interface Enviado { from: string; to: string; subject: string; html: string; replyTo?: string }

function transporteFalso() {
  const enviados: Enviado[] = [];
  return { enviados, sendMail: async (opciones: Enviado) => { enviados.push(opciones); return {}; } };
}


// Sin esto el proceso se queda vivo con la conexión de Prisma abierta y el
// ejecutor de tests no termina nunca.
after(async () => { await db.$disconnect(); });

const entornoOriginal = {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_BUZON_PRUEBAS: process.env.EMAIL_BUZON_PRUEBAS,
  NODE_ENV: process.env.NODE_ENV,
  CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO,
};

/**
 * Monta el buzón a mano.
 *
 * No vale con poner EMAIL_BUZON_PRUEBAS: `buzonPedido()` lo apaga a propósito
 * dentro del ejecutor de tests, para que la suite no deje correos sueltos en
 * storage/correos. Así que aquí se le pone el transporte directamente, que es lo
 * que de verdad se quiere probar: que el buzón escribe el fichero.
 */
function conBuzonDePruebas() {
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  ponerTransporte(buzonDePruebas());
  ponerCuentaDeContacto(undefined);
}

afterEach(async () => {
  await rm(carpetaCorreos(), { recursive: true, force: true });
  ponerTransporte(undefined);
  ponerCuentaDeContacto(undefined);
  for (const [clave, valor] of Object.entries(entornoOriginal)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

describe('buzón de pruebas', () => {
  test('el buzón escribe el correo en disco con su sobre', async () => {
    conBuzonDePruebas();

    const enviado = await EmailService.enviarConfirmacionRegistro('ana@example.es', 'Ana Ruiz');

    assert.equal(enviado, true, 'el envío al buzón cuenta como correcto');
    const ficheros = await readdir(carpetaCorreos());
    assert.equal(ficheros.length, 1);
    const escrito = await readFile(path.join(carpetaCorreos(), ficheros[0]), 'utf8');
    assert.match(escrito, /ana@example\.es/, 'el fichero dice a quién iba');
    assert.match(escrito, /Hemos recibido su solicitud/, 'y lleva el correo entero');
  });

  test('con credenciales, el correo sale por el transporte de siempre y no toca el disco', async () => {
    process.env.EMAIL_USER = 'secretaria@example.es';
    process.env.EMAIL_PASS = 'clave-de-aplicacion';
    const transporte = transporteFalso();
    ponerTransporte(transporte);

    await EmailService.enviarConfirmacionRegistro('ana@example.es', 'Ana Ruiz');

    assert.equal(transporte.enviados.length, 1);
    const ficheros = await readdir(carpetaCorreos()).catch(() => []);
    assert.equal(ficheros.length, 0, 'el buzón de pruebas no se usa si hay cuenta de verdad');
  });
});

// Lo que hoy lleva escrito a mano la plantilla del acuse de registro y que no
// es real: una calle de ejemplo, un horario inventado, un dominio que no es
// nuestro y un escudo de relleno de via.placeholder.com. Si los correos salen
// de verdad, esto llega a gente que se presentaría en una dirección falsa.
const RELLENO = ['C/ Falsa', 'Martes y Jueves', 'tucofradia.com', 'via.placeholder.com', '29000 Málaga'];

function conCuentaDeVerdad() {
  process.env.EMAIL_USER = 'secretaria@example.es';
  process.env.EMAIL_PASS = 'clave-de-aplicacion';
  delete process.env.EMAIL_BUZON_PRUEBAS;
  const transporte = transporteFalso();
  ponerTransporte(transporte);
  ponerCuentaDeContacto(undefined);
  return transporte;
}

describe('los correos no inventan datos de la entidad', () => {
  test('el acuse de registro no lleva la dirección, el horario ni el escudo de relleno', async () => {
    const transporte = conCuentaDeVerdad();

    await EmailService.enviarConfirmacionRegistro('ana@example.es', 'Ana Ruiz');

    const [correo] = transporte.enviados;
    for (const dato of RELLENO) {
      assert.ok(!correo.html.includes(dato), `el correo sigue llevando el dato inventado «${dato}»`);
    }
  });
});

describe('un correo que no sale deja rastro', () => {
  // Hasta ahora el fallo moría en un console.error: el alta se completaba, el
  // solicitante no recibía nada y en el CMS no había forma de enterarse.
  test('el fallo de envío se registra en la auditoría', async () => {
    process.env.EMAIL_USER = 'secretaria@example.es';
    process.env.EMAIL_PASS = 'clave-de-aplicacion';
    delete process.env.EMAIL_BUZON_PRUEBAS;
    ponerTransporte({
      sendMail: async () => { throw new Error('535 Authentication failed'); },
    });
    const antes = new Date();

    const enviado = await EmailService.enviarConfirmacionRegistro('ana@example.es', 'Ana Ruiz');

    assert.equal(enviado, false);
    const registro = await db.auditLog.findFirst({
      where: { action: 'EMAIL_FALLIDO', createdAt: { gte: antes } },
      orderBy: { id: 'desc' },
    });
    assert.ok(registro, 'no se ha registrado el fallo en la auditoría');
    const detalles = registro.detalles as { para?: string; asunto?: string };
    assert.match(String(detalles.para), /@example\.es/, 'el registro dice a quién no llegó');
    assert.ok(!String(detalles.para).includes('ana@'), 'pero sin guardar la dirección entera');
  });
});

// ---------------------------------------------------------------------------
//  Los correos del expediente, disparados desde las operaciones de verdad
// ---------------------------------------------------------------------------

const SIN_DB = 'sin base de datos disponible';
let dbDisponible = false;

before(async () => {
  const limite = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), limite]);
});

/** Los envíos van sin `await` a propósito (no pueden frenar la operación). */
const dejarSalirLosCorreos = () => new Promise((resolve) => setImmediate(resolve));

describe('aviso a Secretaría de una solicitud nueva', () => {
  test('al registrarse sale el acuse al solicitante Y el aviso al buzón de Secretaría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const transporte = conCuentaDeVerdad();
    process.env.CONTACT_EMAIL_TO = 'secretaria@grupoparroquial.test';
    const sufijo = `${Date.now()}${process.pid}`;
    const email = `solicitante-${sufijo}@ejemplo.test`;

    try {
      await RegistroService.registerUser({
        usuario: { email, dni: `S${sufijo}`, password: PASSWORD_PRUEBA, nombre: 'Lucía', apellidos: 'Moreno Gil', telefono: '600000000' },
        titular: { fechaNacimiento: '1990-01-01', sexo: 'HOMBRE', estadoCivil: 'SOLTERO', fechaBautismo: '1990-12-28' },
      } as never);
      await dejarSalirLosCorreos();

      const destinos = transporte.enviados.map((c) => c.to);
      assert.ok(destinos.includes(email), 'falta el acuse al solicitante');
      assert.ok(destinos.includes('secretaria@grupoparroquial.test'), 'falta el aviso a Secretaría');

      const aviso = transporte.enviados.find((c) => c.to === 'secretaria@grupoparroquial.test')!;
      assert.match(aviso.html, /Lucía/, 'el aviso dice de quién es la solicitud');
      assert.match(aviso.html, /\/cms\/hermanos/, 'y lleva al sitio donde se resuelve');
    } finally {
      await db.hermano.deleteMany({ where: { email } });
      await db.user.deleteMany({ where: { email } });
    }
  });
});

describe('aprobación de la solicitud', () => {
  // Hasta ahora aprobar era mudo: la ficha pasaba a activa y recibía número,
  // pero al hermano no se le decía nada.
  test('al aprobar, el hermano recibe un correo con su número', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const transporte = conCuentaDeVerdad();
    const sufijo = `${Date.now()}${process.pid}a`;
    const email = `aprobado-${sufijo}@ejemplo.test`;
    const cuenta = await db.user.create({
      data: {
        email, password: 'x', dni: `A${sufijo}`, nombre: 'Mateo', apellidos: 'Cano Ruiz',
        telefono: '600000000', active: false,
      },
    });
    await db.hermano.create({
      data: {
        userId: cuenta.id, nombre: 'Mateo', apellidos: 'Cano Ruiz', dni: `A${sufijo}`,
        fechaNacimiento: new Date('1990-01-01'), email, activo: false, esTitular: true,
      },
    });

    try {
      await SolicitudesService.aprobarSolicitud(cuenta.id);
      await dejarSalirLosCorreos();

      const aviso = transporte.enviados.find((c) => c.to === email);
      assert.ok(aviso, 'no se ha avisado al hermano de que su solicitud está aprobada');
      const ficha = await db.hermano.findFirst({ where: { userId: cuenta.id } });
      assert.ok(ficha?.numeroHermano, 'la ficha debería haber recibido número');
      assert.match(aviso.html, new RegExp(String(ficha.numeroHermano)), 'el correo debe decirle su número');
    } finally {
      await db.hermano.deleteMany({ where: { userId: cuenta.id } });
      await db.user.deleteMany({ where: { id: cuenta.id } });
    }
  });
});

describe('rechazo de la solicitud', () => {
  // `rechazarSolicitud` BORRA la cuenta entera cuando nunca llegó a aprobarse,
  // dirección incluida: hay que leer el destinatario antes de la transacción o
  // no queda a quién escribir.
  test('al rechazar una cuenta que se borra entera, el aviso llega igualmente', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const transporte = conCuentaDeVerdad();
    const sufijo = `${Date.now()}${process.pid}r`;
    const email = `rechazado-${sufijo}@ejemplo.test`;
    const cuenta = await db.user.create({
      data: {
        email, password: 'x', dni: `R${sufijo}`, nombre: 'Julia', apellidos: 'Prados Vega',
        telefono: '600000000', active: false,
      },
    });
    await db.hermano.create({
      data: {
        userId: cuenta.id, nombre: 'Julia', apellidos: 'Prados Vega', dni: `R${sufijo}`,
        fechaNacimiento: new Date('1990-01-01'), email, activo: false, esTitular: true,
      },
    });

    try {
      await SolicitudesService.rechazarSolicitud(cuenta.id);
      await dejarSalirLosCorreos();

      assert.equal(await db.user.count({ where: { id: cuenta.id } }), 0, 'la cuenta debía borrarse');
      const aviso = transporte.enviados.find((c) => c.to === email);
      assert.ok(aviso, 'no se ha avisado del rechazo antes de borrar la cuenta');
      assert.ok(!aviso.subject.includes('Julia'), 'el asunto no debe reintroducir el nombre recién borrado');
    } finally {
      await db.hermano.deleteMany({ where: { userId: cuenta.id } });
      await db.user.deleteMany({ where: { id: cuenta.id } });
    }
  });
});

describe('baja en el censo', () => {
  test('al dar de baja a un hermano se le avisa', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const transporte = conCuentaDeVerdad();
    const sufijo = `${Date.now()}${process.pid}b`;
    const email = `baja-${sufijo}@ejemplo.test`;
    const cuenta = await db.user.create({
      data: {
        email, password: 'x', dni: `B${sufijo}`, nombre: 'Rosa', apellidos: 'Lara Ponce',
        telefono: '600000000', active: true,
      },
    });
    const ficha = await db.hermano.create({
      data: {
        userId: cuenta.id, nombre: 'Rosa', apellidos: 'Lara Ponce', dni: `B${sufijo}`,
        fechaNacimiento: new Date('1990-01-01'), email, activo: true, esTitular: true,
        fechaAlta: new Date('2020-01-01'),
      },
    });

    try {
      await CensoService.darDeBajaHermano(ficha.id);
      await dejarSalirLosCorreos();

      const aviso = transporte.enviados.find((c) => c.to === email);
      assert.ok(aviso, 'no se ha avisado de la baja');
      assert.match(aviso.subject, /[Bb]aja/, 'el asunto debe decir de qué va');
    } finally {
      await db.hermano.deleteMany({ where: { userId: cuenta.id } });
      await db.user.deleteMany({ where: { id: cuenta.id } });
    }
  });
});

describe('sin cuenta configurada no se toca la red', () => {
  // Dar de baja, aprobar y rechazar mandan correo, y cinco ficheros de test
  // hacen esas operaciones. Sin credenciales, nodemailer intentaba conectar con
  // Gmail en cada una: la suite entera se quedaba colgada esperando al SMTP, y
  // el CI no tiene .env ninguno. Sin cuenta se falla en el acto y sin salir.
  test('el envío falla en el acto, sin crear ningún transporte de red', async () => {
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_BUZON_PRUEBAS;
    ponerTransporte(undefined);
    const crear = mock.method(nodemailer, 'createTransport', () => { throw new Error('no debería crearse'); });

    try {
      const enviado = await EmailService.enviarConfirmacionRegistro('ana@example.es', 'Ana Ruiz');

      assert.equal(enviado, false, 'sin cuenta no se puede enviar');
      assert.equal(crear.mock.callCount(), 0, 'no debe abrirse ninguna conexión SMTP');
    } finally {
      crear.mock.restore();
    }
  });
});

describe('el buzón no se enciende dentro de la suite', () => {
  // Con el buzón activo en el .env, cada `npm test` dejaba 46 correos sueltos en
  // storage/correos: los que sueltan aprobar, rechazar y dar de baja en los
  // cinco ficheros que hacen esas operaciones. El .env del desarrollador no
  // tiene por qué cambiar de valor para ejecutar los tests.
  test('ejecutándose bajo el runner, el buzón queda apagado aunque se pida', () => {
    process.env.EMAIL_BUZON_PRUEBAS = 'true';
    process.env.NODE_ENV = 'development';

    assert.equal(buzonPedido(), false, 'la suite no debe escribir correos en disco');
  });

  test('fuera del runner, la variable sí lo enciende', () => {
    assert.equal(buzonPedido({ EMAIL_BUZON_PRUEBAS: 'true', NODE_ENV: 'development' }), true);
    assert.equal(buzonPedido({ EMAIL_BUZON_PRUEBAS: 'true', NODE_ENV: 'production' }), false, 'nunca en producción');
    assert.equal(buzonPedido({ NODE_ENV: 'development' }), false, 'ni sin pedirlo');
  });
});
