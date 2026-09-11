// dotenv no se carga solo al importar un módulo suelto: sin esto no hay JWT_SECRET
import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Clave fija para este proceso ANTES del primer uso (la del módulo es perezosa
// y se queda con la primera que ve). Así el test del cambio de clave puede
// comprobar el paso de la derivada de desarrollo a TOTP_ENC_KEY.
const CLAVE_PRUEBA = 'ab'.repeat(32);
process.env.TOTP_ENC_KEY = CLAVE_PRUEBA;

const { cifrarSecretoTotp, leerSecretoTotp, estaCifrado, resolverClaveTotp, SecretoTotpIlegibleError } = await import('../src/utils/cifrado-totp.js');

const SECRETO = 'JBSWY3DPEHPK3PXP';

test('el secreto cifrado lleva el prefijo de versión y no deja ver el original', () => {
  const guardado = cifrarSecretoTotp(SECRETO);
  assert.ok(guardado.startsWith('v1:'));
  assert.ok(!guardado.includes(SECRETO));
  assert.equal(guardado.split(':').length, 4, 'v1:<iv>:<etiqueta>:<cifrado>');
});

test('cifrar y leer devuelve el mismo secreto, sin pedir recifrarlo', () => {
  assert.deepEqual(leerSecretoTotp(cifrarSecretoTotp(SECRETO)), { secreto: SECRETO, recifrar: false });
});

test('dos cifrados del mismo secreto no se parecen (IV aleatorio)', () => {
  assert.notEqual(cifrarSecretoTotp(SECRETO), cifrarSecretoTotp(SECRETO));
});

test('un secreto antiguo en claro sigue sirviendo y pide cifrarse', () => {
  assert.equal(estaCifrado(SECRETO), false);
  assert.deepEqual(leerSecretoTotp(SECRETO), { secreto: SECRETO, recifrar: true });
});

test('un cifrado manipulado no se acepta', () => {
  const guardado = cifrarSecretoTotp(SECRETO);
  const [v, iv, etiqueta, cifrado] = guardado.split(':');
  // Un bit cambiado en el texto cifrado: GCM lo detecta por la etiqueta.
  const tocado = Buffer.from(cifrado, 'base64url');
  tocado[0] ^= 1;
  assert.throws(() => leerSecretoTotp([v, iv, etiqueta, tocado.toString('base64url')].join(':')));
});

// GCM, sin fijar la longitud, acepta etiquetas de hasta 4 bytes: con una tan
// corta, falsificar un cifrado que pase la comprobación deja de ser impensable.
test('una etiqueta truncada no se acepta aunque sea el principio de la buena', () => {
  const [v, iv, etiqueta, cifrado] = cifrarSecretoTotp(SECRETO).split(':');
  for (const bytes of [4, 8, 12, 15]) {
    const corta = Buffer.from(etiqueta, 'base64url').subarray(0, bytes).toString('base64url');
    assert.throws(() => leerSecretoTotp([v, iv, corta, cifrado].join(':')), SecretoTotpIlegibleError, `etiqueta de ${bytes} bytes`);
  }
});

test('un IV de otra longitud tampoco se acepta', () => {
  const [v, , etiqueta, cifrado] = cifrarSecretoTotp(SECRETO).split(':');
  const ivLargo = Buffer.alloc(16, 1).toString('base64url');
  assert.throws(() => leerSecretoTotp([v, ivLargo, etiqueta, cifrado].join(':')), SecretoTotpIlegibleError);
});

test('cifrado con otra clave (que no es la derivada) no se puede leer', () => {
  const otra = Buffer.alloc(32, 7);
  assert.throws(() => leerSecretoTotp(cifrarSecretoTotp(SECRETO, otra)), /TOTP_ENC_KEY/);
});

// El caso de quien activó el 2FA en desarrollo sin TOTP_ENC_KEY y la añade
// después: sin el respaldo de la derivada, su cuenta no podría entrar al CMS.
test('fuera de producción se lee lo cifrado con la clave derivada y se pide recifrar', () => {
  const derivada = resolverClaveTotp({ JWT_SECRET: process.env.JWT_SECRET, NODE_ENV: 'development' });
  assert.equal(derivada.derivada, true);
  const guardado = cifrarSecretoTotp(SECRETO, derivada.clave);
  assert.deepEqual(leerSecretoTotp(guardado), { secreto: SECRETO, recifrar: true });
});

test('en producción sin TOTP_ENC_KEY no arranca', () => {
  assert.throws(
    () => resolverClaveTotp({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(64) }),
    /TOTP_ENC_KEY/
  );
});

test('una TOTP_ENC_KEY mal formada se rechaza en cualquier entorno', () => {
  for (const mala of ['corta', 'zz'.repeat(32), 'ab'.repeat(31)]) {
    assert.throws(() => resolverClaveTotp({ TOTP_ENC_KEY: mala, NODE_ENV: 'development', JWT_SECRET: 'x' }), /64 caracteres/);
  }
});

test('con TOTP_ENC_KEY válida se usa tal cual, sin derivar', () => {
  const { clave, derivada } = resolverClaveTotp({ TOTP_ENC_KEY: CLAVE_PRUEBA, NODE_ENV: 'production' });
  assert.equal(derivada, false);
  assert.equal(clave.toString('hex'), CLAVE_PRUEBA);
});

test('sin TOTP_ENC_KEY fuera de producción la clave sale de JWT_SECRET y es estable', () => {
  const a = resolverClaveTotp({ JWT_SECRET: 'secreto-de-desarrollo', NODE_ENV: 'development' });
  const b = resolverClaveTotp({ JWT_SECRET: 'secreto-de-desarrollo' });
  assert.equal(a.derivada, true);
  assert.equal(a.clave.length, 32);
  assert.ok(a.clave.equals(b.clave), 'la misma JWT_SECRET debe dar la misma clave o no se podría descifrar tras reiniciar');
});
