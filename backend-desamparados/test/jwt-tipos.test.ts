// dotenv no se carga solo al importar un módulo suelto: sin esto no hay JWT_SECRET
import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateToken,
  generatePending2FAToken,
  verifyToken,
  duracionSesionSegundos,
  esStaff,
  RECORDARME_SEGUNDOS
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

test('con "recordarme" la sesión dura 72 h para cualquier rol', () => {
  for (const role of ['USER', 'SECRETARIA', 'ADMIN']) {
    const payload = verifyToken(generateToken(7, role, true), 'session');
    assert.ok(payload, `token de ${role} debe verificarse`);
    assert.equal(payload!.exp! - payload!.iat!, RECORDARME_SEGUNDOS, `rol ${role}`);
  }
});

test('sin "recordarme" se mantiene la duración por rol', () => {
  const payload = verifyToken(generateToken(7, 'USER', false), 'session');
  assert.equal(payload!.exp! - payload!.iat!, 4 * 3600);
});

test('el testigo de 2FA lleva el "recordarme" del primer factor', () => {
  assert.equal(verifyToken(generatePending2FAToken(7, true), '2fa_pending')?.rem, true);
  assert.equal(verifyToken(generatePending2FAToken(7), '2fa_pending')?.rem, false);
});

test('el token de sesión lleva el origen del login', () => {
  assert.equal(verifyToken(generateToken(7, 'USER', false, 'hermanos'), 'session')?.origen, 'hermanos');
  assert.equal(verifyToken(generateToken(7, 'ADMIN', false, 'cms'), 'session')?.origen, 'cms');
});

test('el testigo de 2FA propaga el origen del login', () => {
  assert.equal(verifyToken(generatePending2FAToken(7, false, 'hermanos'), '2fa_pending')?.origen, 'hermanos');
});

// `iat` va en segundos enteros: comparado con tokenValidAfter, el login que
// sigue a un cierre de sesión en el mismo segundo nacía ya revocado.
test('el token de sesión lleva el momento de emisión en milisegundos', () => {
  const antes = Date.now();
  const payload = verifyToken(generateToken(7, 'USER'), 'session')!;
  assert.equal(typeof payload.emitidoMs, 'number');
  assert.ok(payload.emitidoMs! >= antes && payload.emitidoMs! <= Date.now());
  assert.equal(Math.floor(payload.emitidoMs! / 1000), payload.iat, 'emitidoMs e iat deben describir el mismo instante');
});

// El testigo es de un solo uso porque lleva el último intervalo TOTP aceptado:
// en cuanto la cuenta acepta otro, deja de coincidir.
test('el testigo de 2FA lleva el último intervalo aceptado de la cuenta', () => {
  assert.equal(verifyToken(generatePending2FAToken(7, false, 'cms', 58_000_123), '2fa_pending')?.paso2fa, 58_000_123);
  assert.equal(verifyToken(generatePending2FAToken(7), '2fa_pending')?.paso2fa, null, 'sin 2FA usado todavía va null, no ausente');
});

// Sin él, un cambio de contraseña o un cierre de todas las sesiones entre los
// dos pasos del login no tocaba el testigo, y sus cinco minutos seguían valiendo.
test('el testigo de 2FA también lleva el momento de emisión en milisegundos', () => {
  const antes = Date.now();
  const payload = verifyToken(generatePending2FAToken(7), '2fa_pending')!;
  assert.ok(typeof payload.emitidoMs === 'number' && payload.emitidoMs >= antes && payload.emitidoMs <= Date.now());
});

test('esStaff distingue los roles con acceso al CMS', () => {
  assert.equal(esStaff('TESORERIA'), true);
  assert.equal(esStaff('USER'), false);
});
