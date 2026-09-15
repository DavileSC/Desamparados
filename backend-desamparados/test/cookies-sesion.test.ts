import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { opcionesCookieSesion, nombreCookie, COOKIE_CMS, COOKIE_HERMANO, COOKIE_2FA } from '../src/utils/cookies.js';
import { RECORDARME_SEGUNDOS } from '../src/utils/jwt.handle.js';

test('los nombres de las cookies son los del contrato', () => {
  assert.equal(COOKIE_CMS, 'desamparados_cms');
  assert.equal(COOKIE_HERMANO, 'desamparados_hermano');
  assert.equal(COOKIE_2FA, 'desamparados_2fa');
  assert.equal(nombreCookie('cms'), COOKIE_CMS);
  assert.equal(nombreCookie('hermanos'), COOKIE_HERMANO);
});

test('las dos cookies son distintas: por eso pueden convivir', () => {
  // Con una sola cookie, entrar al área de hermanos sustituía la del CMS y
  // dejaba la administración sin sesión. Es el hallazgo que cierra esta fase.
  assert.notEqual(COOKIE_CMS, COOKIE_HERMANO);
});

test('la cookie del CMS muere al cerrar el navegador, sea cual sea el rol', () => {
  // El CMS se usa desde equipos compartidos de la casa parroquial.
  for (const role of ['ADMIN', 'TESORERIA', 'SECRETARIA']) {
    const opciones = opcionesCookieSesion('cms', role);
    assert.equal(opciones.maxAge, undefined, `rol ${role}`);
    assert.equal(opciones.httpOnly, true);
    assert.equal(opciones.sameSite, 'strict');
    assert.equal(opciones.path, '/api');
  }
});

test('la cookie de hermanos persiste, también para un cargo de la junta', () => {
  // Un Tesorero que entra a ver su propio perfil está en el área de hermanos:
  // la duración la decide el área, no su cargo.
  const hermano = opcionesCookieSesion('hermanos', 'USER');
  const tesorero = opcionesCookieSesion('hermanos', 'TESORERIA');
  assert.ok(typeof hermano.maxAge === 'number' && hermano.maxAge > 0);
  assert.ok(typeof tesorero.maxAge === 'number' && tesorero.maxAge > 0);
});

test('con "recordarme" las dos persisten 72 h', () => {
  for (const area of ['cms', 'hermanos'] as const) {
    assert.equal(opcionesCookieSesion(area, 'ADMIN', true).maxAge, RECORDARME_SEGUNDOS * 1000, `área ${area}`);
  }
});

test('Secure queda desactivado fuera de producción', () => {
  assert.equal(opcionesCookieSesion('hermanos', 'USER').secure, false);
});
