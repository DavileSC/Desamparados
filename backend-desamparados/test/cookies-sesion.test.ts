import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { opcionesCookieSesion, COOKIE_SESION, COOKIE_2FA } from '../src/utils/cookies.js';
import { RECORDARME_SEGUNDOS } from '../src/utils/jwt.handle.js';

test('la cookie del staff muere al cerrar el navegador', () => {
  const opciones = opcionesCookieSesion('SECRETARIA');
  assert.equal(opciones.maxAge, undefined, 'el staff no debe llevar Max-Age');
  assert.equal(opciones.httpOnly, true);
  assert.equal(opciones.sameSite, 'strict');
  assert.equal(opciones.path, '/api');
});

test('la cookie de un hermano persiste 4 h', () => {
  const opciones = opcionesCookieSesion('USER');
  assert.equal(opciones.maxAge, 4 * 3600 * 1000);
  assert.equal(opciones.httpOnly, true);
  assert.equal(opciones.sameSite, 'strict');
});

test('con "recordarme" la cookie persiste 72 h para cualquier rol', () => {
  for (const role of ['USER', 'SECRETARIA', 'ADMIN']) {
    assert.equal(
      opcionesCookieSesion(role, true).maxAge,
      RECORDARME_SEGUNDOS * 1000,
      `rol ${role}`
    );
  }
});

test('Secure queda desactivado fuera de produccion', () => {
  assert.equal(opcionesCookieSesion('USER').secure, false);
});

test('los nombres de las cookies son los del contrato', () => {
  assert.equal(COOKIE_SESION, 'desamparados_session');
  assert.equal(COOKIE_2FA, 'desamparados_2fa');
});
