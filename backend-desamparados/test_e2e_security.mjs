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
//  Aquí falla ya el primer paso: `check('admin login OK', ... && r.json?.token)`
//  da por bueno el login solo si viene un token en el cuerpo, y no viene.
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

// Test E2E de los fixes de seguridad
// Uso: node test_e2e_security.mjs 1   (fixes generales)
//      node test_e2e_security.mjs 2   (flujo 2FA + lockout)  ← reinicia el servidor antes
import fs from 'fs';
import path from 'path';

const PARTE = parseInt(process.argv[2] || '1');
const BASE = 'http://127.0.0.1:3001';
const TMP = path.join(process.env.TEMP || '.', 'sec_test_files');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

async function api(method, p, body, token, isForm = false) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined)
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

const step = (n) => console.log(`\n--- ${n} ---`);
let pass = 0, fail = 0;
const check = (desc, ok, extra = '') => {
  if (ok) { pass++; console.log(`  OK ${desc} ${extra}`); }
  else { fail++; console.log(`  FAIL ${desc} ${extra}`); }
};

// PNG real de 1x1 (magic numbers válidos)
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

if (PARTE === 1) {

  step('FIX Extra: GET /health');
  let r = await api('GET', '/health');
  check('health responde 200', r.status === 200 && r.json?.status === 'ok');

  step('Setup: login admin');
  r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
  check('admin login OK', r.status === 200 && r.json?.token);
  const adminToken = r.json?.token;

  step('FIX 1 (CRITICO): XSS almacenado en noticias');
  const xssPayload = '<p>Noticia legit</p><script>alert("XSS")</script><img src=x onerror="alert(1)"><b>negrita ok</b>';
  r = await api('POST', '/api/news', {
    titulo: 'Noticia Test XSS',
    extracto: 'extracto <b>con html</b> e <img src=x onerror=1>',
    contenido: xssPayload,
    visible: true
  }, adminToken);
  check('noticia creada', r.status === 201, `id=${r.json?.id}`);
  const noticiaId = r.json?.id;
  const contenido = r.json?.contenido || '';
  check('script/onevent ELIMINADOS', !contenido.includes('<script') && !contenido.includes('onerror'));
  check('formato legitimo (<b>, <p>) conservado', contenido.includes('<b>negrita ok</b>') && contenido.includes('<p>Noticia legit</p>'));
  check('extracto sin HTML', !(r.json?.extracto || '').includes('<'));
  r = await api('PUT', `/api/news/${noticiaId}`, { contenido: '<script>hack()</script><i>ok</i>' }, adminToken);
  check('update tambien sanitiza', r.status === 200 && !(r.json?.contenido || '').includes('<script') && (r.json?.contenido || '').includes('<i>ok</i>'));

  step('FIX 3 (CRITICO): Upload extension vs contenido real');
  // A: PNG real con extension .png → ACEPTAR
  let form = new FormData();
  form.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'test.png');
  r = await api('POST', '/api/upload/upload', form, adminToken, true);
  check('PNG real con .png → aceptado', r.status === 201);

  // B: PNG real pero extension .html → RECHAZAR
  form = new FormData();
  form.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'malicioso.html');
  r = await api('POST', '/api/upload/upload', form, adminToken, true);
  check('PNG renombrado a .html → rechazado', r.status === 400);

  // C: extension .exe → multer lo rechaza
  form = new FormData();
  form.append('file', new Blob([Buffer.from('MZbinary')], { type: 'application/octet-stream' }), 'virus.exe');
  r = await api('POST', '/api/upload/upload', form, adminToken, true);
  check('.exe → rechazado por el filtro', r.status === 400);

  step('FIX 4 (ALTO): Invalidacion de tokens (rol fresco de BD)');
  r = await api('POST', '/api/auth/login', { email: 'hermano@cofradia.com', password: 'user123' });
  const hermanoUserId = r.json?.user?.id;
  check('hermano login OK', r.status === 200);

  r = await api('POST', '/api/admin/staff/promote', { userId: hermanoUserId, role: 'REDES' }, adminToken);
  check('promote a REDES', r.status === 200);
  r = await api('POST', '/api/auth/login', { email: 'hermano@cofradia.com', password: 'user123' });
  const redesToken = r.json?.token;
  check('login con rol REDES', r.json?.user?.role === 'REDES');
  r = await api('POST', '/api/news', { titulo: 'prueba redes', contenido: 'x', extracto: 'x' }, redesToken);
  check('REDES puede crear noticia', r.status === 201);

  // Degradar → el token VIEJO debe perder el acceso staff AL INSTANTE
  r = await api('POST', '/api/admin/staff/demote', { userId: hermanoUserId }, adminToken);
  check('demote OK', r.status === 200);
  // 401 = sesión revocada (tokenValidAfter) | 403 = rol fresco insuficiente. Ambos CIERRAN el paso.
  r = await api('GET', '/api/hermanos/admin/solicitudes', null, redesToken);
  check('token viejo degradado → SIN acceso admin', r.status === 401 || r.status === 403, `status=${r.status}`);
  r = await api('POST', '/api/news', { titulo: 'ya no puedo', contenido: 'x', extracto: 'x' }, redesToken);
  check('token viejo degradado → SIN acceso CMS', r.status === 401 || r.status === 403, `status=${r.status}`);

  step('FIX 5 (ALTO): CORS');
  const corsRes = await fetch(`${BASE}/health`);
  const allowOrigin = corsRes.headers.get('access-control-allow-origin');
  check('CORS con origen del .env (no wildcard)', allowOrigin === 'http://localhost:3000', `origin=${allowOrigin}`);

  step('FIX (BAJO): Tope de paginacion');
  r = await api('GET', '/api/hermanos/admin/all?limit=999999', null, adminToken);
  check('limit=999999 → tope 100 aplicado', r.status === 200 && r.json?.meta?.limit === 100);

  step('FIX (BAJO): Whitelist de claves de configuracion');
  r = await api('POST', '/api/admin/config', { key: 'clave_maliciosa_arbitraria', value: '123' }, adminToken);
  check('clave desconocida → rechazada', r.status === 400);
  r = await api('POST', '/api/admin/config', { key: 'precio_papeleta_sitio', value: '35' }, adminToken);
  check('clave valida → aceptada', r.status === 200);

  step('FIX (BAJO): No cobrar recibos inexistentes/anulados');
  r = await api('POST', '/api/recibos/admin/999999/pagar', null, adminToken);
  check('recibo inexistente → 400 con mensaje claro', r.status === 400 && /no encontrado/i.test(r.json?.error || ''));

} else if (PARTE === 3) {
  // PARTE 3: Lockout de login por cuenta + Auditoría + RGPD
  // Ejecutar tras reiniciar el servidor (limpia el authLimiter en memoria).
  // Logins usados: 1 admin + 6 malas hermano + 1 buena hermano + 1 rgpd + 1 rgpd-rechek = 10 < 20

  step('Setup: login admin');
  let r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
  check('admin login OK', r.status === 200 && r.json?.token);
  const adminToken = r.json?.token;

  step('FIX: Lockout por cuenta en login de contrasena');
  // 5 contrasenas malas → la 5a activa el bloqueo
  let lastMsg = '';
  for (let i = 1; i <= 5; i++) {
    r = await api('POST', '/api/auth/login', { email: 'hermano@cofradia.com', password: 'wrongpass' });
    lastMsg = r.json?.error || '';
  }
  check('5 fallos procesados (401)', r.status === 401);

  // 6a con la contrasena CORRECTA → sigue bloqueado
  r = await api('POST', '/api/auth/login', { email: 'hermano@cofradia.com', password: 'user123' });
  check('contrasena correcta pero BLOQUEADO', r.status === 401 && /bloqueada/i.test(r.json?.error || ''), `msg="${r.json?.error || ''}"`);

  // Otra cuenta no se ve afectada (lockout por cuenta, no global)
  r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
  check('otra cuenta sigue operativa (bloqueo solo por cuenta)', r.status === 200);

  step('FIX: Registro de auditoria');
  // La aprobacion de la solicitud del final del test ya habra generado entradas;
  // comprobamos que promote/demote de la parte 1 no son necesarios: usamos config.
  r = await api('POST', '/api/admin/config', { key: 'precio_papeleta_sitio', value: '31' }, adminToken);
  check('config update OK', r.status === 200);

  r = await api('GET', '/api/admin/audit-logs?action=CONFIG_UPDATE&limit=10', null, adminToken);
  const entries = r.json?.data || [];
  check('audit-logs accesible y con la entrada CONFIG_UPDATE', r.status === 200 && entries.length >= 1);
  check('entrada con usuario e IP registrados', entries[0]?.user?.email === 'admin@cofradia.com' && !!entries[0]?.ip);
  check('entityType/entityId presentes', entries[0]?.entityType === 'config' && entries[0]?.entityId === 'precio_papeleta_sitio');

  // Un no-admin no puede ver la auditoria
  // (usamos un usuario nuevo al final del test; el hermano esta bloqueado. Lo probamos con token invalido → 401 es suficiente)
  r = await api('GET', '/api/admin/audit-logs', null, 'token-falso');
  check('audit-logs sin token → 401', r.status === 401);

  step('FIX: RGPD exportacion y supresion');
  // Registramos un usuario nuevo para el flujo RGPD completo
  r = await api('POST', '/api/auth/register', {
    isTutor: false,
    usuario: {
      email: 'rgpd@test.com', password: 'password123', dni: '22222222M',
      nombre: 'Rosa', apellidos: 'Datos Garcia', telefono: '600222333',
      direccion: 'C/ Privacidad 1', poblacion: 'Desamparados', codigoPostal: '03179'
    },
    hermano: { fechaNacimiento: '1992-02-02' }
  });
  check('registro usuario RGPD', r.status === 201);

  // Aprobamos su solicitud (esto tambien audita SOLICITUD_APROBAR)
  r = await api('GET', '/api/hermanos/admin/solicitudes', null, adminToken);
  const rosa = r.json?.data?.find(u => u.email === 'rgpd@test.com');
  r = await api('POST', `/api/hermanos/admin/solicitudes/${rosa.id}/aprobar`, null, adminToken);
  check('solicitud aprobada', r.status === 200);

  // Login del usuario RGPD
  r = await api('POST', '/api/auth/login', { email: 'rgpd@test.com', password: 'password123' });
  check('login usuario RGPD', r.status === 200);
  const rgpdToken = r.json?.token;

  // Exportacion (art. 15)
  r = await api('GET', '/api/auth/mis-datos', null, rgpdToken);
  check('export mis-datos OK', r.status === 200 && r.json?.usuario?.email === 'rgpd@test.com');
  check('export incluye perfiles y SIN secretos', Array.isArray(r.json?.perfilesHermanos) && r.json?.usuario?.password === undefined);

  // Supresion SIN contrasena → rechazada por validacion
  r = await api('DELETE', '/api/auth/mi-cuenta', {}, rgpdToken);
  check('delete sin contrasena → 400', r.status === 400);

  // Supresion con contrasena INCORRECTA → 401
  r = await api('DELETE', '/api/auth/mi-cuenta', { password: 'incorrecta' }, rgpdToken);
  check('delete con contrasena mala → 401', r.status === 401);

  // Supresion correcta (art. 17): anonimizacion
  r = await api('DELETE', '/api/auth/mi-cuenta', { password: 'password123' }, rgpdToken);
  check('delete OK (anonimizado)', r.status === 200);

  // El token viejo queda invalidado (tokenValidAfter)
  r = await api('GET', '/api/auth/mis-datos', null, rgpdToken);
  check('token invalidado tras borrado', r.status === 401);

  // El login antiguo ya no funciona (email anonimizado)
  r = await api('POST', '/api/auth/login', { email: 'rgpd@test.com', password: 'password123' });
  check('login antiguo imposible (cuenta anonimizada)', r.status === 401);

  // Y la auditoria refleja el borrado
  r = await api('GET', '/api/admin/audit-logs?action=CUENTA_AUTODELETE&limit=5', null, adminToken);
  check('auditoria registra el autoborrado', r.status === 200 && (r.json?.data || []).length >= 1);
} else if (PARTE === 2) {
  // NOTA: ejecutar tras reiniciar el servidor (limpia el authLimiter en memoria).
  // Logins usados aqui: 1 (admin) + 1 (2FA needed) + 5 fallos + 1 bloqueado + 1 re-login = 9 < 10

  // otpauth exporta TOTP/Secret como named exports en ESM
  const { TOTP, Secret } = await import('otpauth');

  step('Setup: login admin');
  let r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
  check('admin login OK', r.status === 200 && r.json?.token);
  let adminToken = r.json?.token;

  step('FIX 9 (MEDIO): Lockout de cuenta en 2FA');
  r = await api('GET', '/api/auth/2fa/generate', null, adminToken);
  const secret = r.json?.secret;
  check('QR generado', r.status === 200 && !!secret);
  const totp = new TOTP({ issuer: 'Cofradía Virtual', label: 'admin@cofradia.com', algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
  r = await api('POST', '/api/auth/2fa/enable', { token2fa: totp.generate() }, adminToken);
  check('2FA activado (con 8 backup codes)', r.status === 200 && r.json?.backupCodes?.length === 8);

  r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
  const uid = r.json?.userId;
  check('login pide 2FA', r.json?.status === '2FA_NEEDED');

  // 5 intentos fallidos → el bloqueo se activa en el 5º
  let lastMsg = '';
  for (let i = 1; i <= 5; i++) {
    r = await api('POST', '/api/auth/login/2fa', { userId: uid, token2fa: '000000' });
    lastMsg = r.json?.error || '';
  }
  check('5 fallos procesados', r.status === 401);

  // 6º con codigo CORRECTO → bloqueado (el lockout prevalece sobre el codigo bueno)
  r = await api('POST', '/api/auth/login/2fa', { userId: uid, token2fa: totp.generate() });
  check('codigo correcto pero BLOQUEADO → rechazado', r.status === 401 && /bloqueada/i.test(r.json?.error || ''), `msg="${r.json?.error || ''}"`);

  step('FIX 4 + 9: Rescate de emergencia (admin reset-2fa)');
  r = await api('POST', `/api/auth/admin/reset-2fa/${uid}`, null, adminToken);
  check('rescate admin reset-2fa OK', r.status === 200);

  // El token del admin quedo invalidado (tokenValidAfter) → debe dar 401
  r = await api('GET', '/api/hermanos/admin/solicitudes', null, adminToken);
  check('token del admin invalidado tras el rescate', r.status === 401);

  // Re-login directo sin 2FA
  r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
  check('re-login admin directo tras reset 2FA', r.status === 200 && r.json?.status === 'OK');
  adminToken = r.json?.token;

  // Verificacion final: el lockout en memoria se mantiene para el uid aunque ya no importe
  // (el 2FA esta desactivado). Comprobamos que una ruta normal funciona.
  r = await api('GET', '/api/hermanos/admin/solicitudes', null, adminToken);
  check('rutas admin operativas de nuevo', r.status === 200);
}

console.log(`\n========== PARTE ${PARTE}: ${pass} OK / ${fail} FALLOS ==========`);
if (fail > 0) process.exit(1);
