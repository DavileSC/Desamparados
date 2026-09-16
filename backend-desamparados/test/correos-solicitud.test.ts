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
import { afterEach, describe, test } from 'node:test';
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { EmailService } from '../src/services/email.service.js';

const carpetaCorreos = () => path.join(process.cwd(), 'storage', 'correos');

interface Enviado { from: string; to: string; subject: string; html: string; replyTo?: string }

function transporteFalso() {
  const enviados: Enviado[] = [];
  return { enviados, sendMail: async (opciones: Enviado) => { enviados.push(opciones); return {}; } };
}

const internos = EmailService as unknown as { transporter: unknown; cuentaContacto: unknown };

const entornoOriginal = {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_BUZON_PRUEBAS: process.env.EMAIL_BUZON_PRUEBAS,
  NODE_ENV: process.env.NODE_ENV,
  CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO,
};

/**
 * Deja el servicio sin credenciales y con el buzón pedido a mano.
 *
 * El buzón NO se enciende solo por no haber credenciales: la suite entera corre
 * con NODE_ENV=development y EMAIL_USER vacío, y varios ficheros de test
 * registran hermanos sin aislar storage/ (auth-seguridad.test.ts). Encendido por
 * omisión, esos tests sembrarían de .html el repositorio.
 */
function conBuzonDePruebas() {
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  process.env.EMAIL_BUZON_PRUEBAS = 'true';
  process.env.NODE_ENV = 'development';
  internos.transporter = undefined;
  internos.cuentaContacto = undefined;
}

afterEach(async () => {
  await rm(carpetaCorreos(), { recursive: true, force: true });
  internos.transporter = undefined;
  internos.cuentaContacto = undefined;
  for (const [clave, valor] of Object.entries(entornoOriginal)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

describe('buzón de pruebas', () => {
  test('con EMAIL_BUZON_PRUEBAS, el correo se escribe en disco', async () => {
    conBuzonDePruebas();

    const enviado = await EmailService.enviarConfirmacionRegistro('ana@example.es', 'Ana Ruiz');

    assert.equal(enviado, true, 'el envío al buzón cuenta como correcto');
    const ficheros = await readdir(carpetaCorreos());
    assert.equal(ficheros.length, 1);
    const escrito = await readFile(path.join(carpetaCorreos(), ficheros[0]), 'utf8');
    assert.match(escrito, /ana@example\.es/, 'el fichero dice a quién iba');
    assert.match(escrito, /Solicitud de Registro Recibida/, 'y lleva el correo entero');
  });

  test('con credenciales, el correo sale por el transporte de siempre y no toca el disco', async () => {
    process.env.EMAIL_USER = 'secretaria@example.es';
    process.env.EMAIL_PASS = 'clave-de-aplicacion';
    const transporte = transporteFalso();
    internos.transporter = transporte;

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
  internos.transporter = transporte;
  internos.cuentaContacto = undefined;
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
