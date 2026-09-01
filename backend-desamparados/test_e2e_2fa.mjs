// ============================================================================
//  AVISO: ESTE SCRIPT NO ARRANCA. NO ES UNA RED DE SEGURIDAD.
// ----------------------------------------------------------------------------
//  Desde el paso a la sesión en cookie httpOnly (agosto de 2026) el login YA NO
//  devuelve ningún token en el cuerpo, y la cabecera `Authorization: Bearer`
//  que usa el helper `api()` de aquí abajo YA NO autentica: el servidor no la
//  lee. Lo fijan dos tests de test/integration.test.ts («la cabecera
//  Authorization ya no autentica» y su pareja del 401 sin cookie).
//
//  Resultado: el primer paso que necesita sesión falla y TODO lo que viene
//  después recibe 401. Que el script imprima pasos y termine no demuestra nada.
//  Ya se ha "corregido" a mano dos veces sin reparar en esto.
//
//  PARA REVIVIRLO hacen falta dos cosas, y ninguna es un retoque:
//    1. Cambiar el helper de peticiones a un tarro de cookies: guardar la
//       cookie de sesión de la respuesta del login (`set-cookie`) y reenviarla
//       en la cabecera `Cookie` de cada petición siguiente.
//    2. Apuntarlo a una BASE DE DATOS DESECHABLE. Escribe datos reales
//       (usuarios, altas, ficheros) y hoy el 3001 de desarrollo sirve la base
//       de datos que se está usando de verdad.
//
//  Mientras tanto: NO lo ejecutes y no lo cuentes como cobertura. Lo que sí
//  cubre estos flujos es `npm test` (test/integration.test.ts).
// ============================================================================

// Test E2E del flujo 2FA: activacion (staff), login TOTP, backup codes, disable, restriccion USER
import * as OTPAuth from 'otpauth';

const BASE = 'http://127.0.0.1:3001';

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

const step = (n, txt) => console.log(`\n--- PASO ${n}: ${txt} ---`);

// ============ 1. Login admin ============
step(1, 'Login del ADMIN (sin 2FA todavia)');
let r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
console.log('HTTP', r.status, '| role:', r.json?.user?.role);
let adminToken = r.json?.token;

// ============ 2. Generar QR (devuelve secret) ============
step(2, 'GET /2fa/generate (staff OK)');
r = await api('GET', '/api/auth/2fa/generate', null, adminToken);
console.log('HTTP', r.status, '| secret recibido:', r.json?.secret ? 'SI' : 'NO', '| QR:', r.json?.qrCodeUrl ? 'SI' : 'NO');
const secret = r.json?.secret;

// ============ 3. Activar 2FA con TOTP calculado ============
const totp = new OTPAuth.TOTP({
  issuer: 'Cofradía Virtual',
  label: 'admin@cofradia.com',
  algorithm: 'SHA1', digits: 6, period: 30,
  secret: OTPAuth.Secret.fromBase32(secret)
});
const codigo = totp.generate();

step(3, `POST /2fa/enable con TOTP real (${codigo})`);
r = await api('POST', '/api/auth/2fa/enable', { token2fa: codigo }, adminToken);
console.log('HTTP', r.status, '| backupCodes:', r.json?.backupCodes?.length, 'codigos');
const backupCodes = r.json?.backupCodes || [];
if (backupCodes.length) console.log('   Ejemplo formato:', backupCodes[0]);

// ============ 4. Login ahora pide 2FA ============
step(4, 'Login del ADMIN (debe pedir 2FA)');
r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
console.log('HTTP', r.status, '| status:', r.json?.status, '| userId:', r.json?.userId);
const userId = r.json?.userId;

// ============ 5. Login 2FA con TOTP ============
const codigo2 = totp.generate();
step(5, `POST /login/2fa con TOTP (${codigo2})`);
r = await api('POST', '/api/auth/login/2fa', { userId, token2fa: codigo2 });
console.log('HTTP', r.status, '| status:', r.json?.status, '| token OK:', !!r.json?.token);
adminToken = r.json?.token;

// ============ 6. Login 2FA con codigo de respaldo ============
step(6, 'POST /login/2fa con BACKUP CODE (pierde el movil)');
r = await api('POST', '/api/auth/login/2fa', { userId, token2fa: backupCodes[0] });
console.log('HTTP', r.status, '| status:', r.json?.status, '| backupCodesRemaining:', r.json?.user?.backupCodesRemaining);
adminToken = r.json?.token;

// ============ 7. Reutilizar el MISMO backup code → debe fallar ============
step(7, 'Reutilizar el mismo backup code (debe fallar)');
r = await api('POST', '/api/auth/login/2fa', { userId, token2fa: backupCodes[0] });
console.log('HTTP', r.status, '| error:', r.json?.error || r.json?.message);

// ============ 8. Desactivar 2FA con otro backup code ============
step(8, 'POST /2fa/disable con backup code (cambio de movil)');
r = await api('POST', '/api/auth/2fa/disable', { token2fa: backupCodes[1] }, adminToken);
console.log('HTTP', r.status, JSON.stringify(r.json));

// ============ 9. Login admin ya sin 2FA ============
step(9, 'Login del ADMIN (directo, sin 2FA)');
r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
console.log('HTTP', r.status, '| status:', r.json?.status);

// ============ 10. USER normal NO puede activar 2FA ============
step(10, 'USER normal intenta /2fa/generate → debe dar 403');
r = await api('POST', '/api/auth/login', { email: 'hermano@cofradia.com', password: 'user123' });
const userToken = r.json?.token;
r = await api('GET', '/api/auth/2fa/generate', null, userToken);
console.log('HTTP', r.status, '| error:', r.json?.message);

console.log('\n========== FIN DE PRUEBAS 2FA ==========');
