// dotenv no se carga solo al importar un módulo suelto: sin esto no hay JWT_SECRET
import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateToken,
  generatePending2FAToken,
  verifyToken,
  duracionSesionSegundos,
  esStaff
} from '../src/utils/jwt.handle.js';

// El caso que justifica todo el claim `typ`: el testigo de 2FA ya identifica a un
// usuario, así que si valiera como token de sesión permitiría saltarse el segundo
// factor por completo.
test('un testigo de 2FA no vale como token de sesión', () => {
  assert.equal(verifyToken(generatePending2FAToken(7), 'session'), null);
});

test('un token de sesión no vale como testigo de 2FA', () => {
  assert.equal(verifyToken(generateToken(7, 'USER'), '2fa_pending'), null);
});

test('cada token se verifica correctamente con su propio tipo', () => {
  assert.equal(verifyToken(generateToken(7, 'USER'), 'session')?.id, 7);
  assert.equal(verifyToken(generatePending2FAToken(7), '2fa_pending')?.id, 7);
});

test('un token con la firma manipulada no vale', () => {
  const token = generateToken(7, 'USER');
  assert.equal(verifyToken(token.slice(0, -2) + 'xx', 'session'), null);
});

test('el staff del CMS dura 8 h y los hermanos 4 h', () => {
  assert.equal(duracionSesionSegundos('SECRETARIA'), 8 * 3600);
  assert.equal(duracionSesionSegundos('ADMIN'), 8 * 3600);
  assert.equal(duracionSesionSegundos('USER'), 4 * 3600);
});

test('esStaff distingue los roles con acceso al CMS', () => {
  assert.equal(esStaff('TESORERIA'), true);
  assert.equal(esStaff('USER'), false);
});
