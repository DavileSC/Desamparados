// Test E2E del flujo Tutor/Menor/Emancipación
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

// ============ 1. REGISTRO: Tutor Maria + hijo Pablito ============
step(1, 'Registro de tutor (Maria) con hijo menor (Pablito)');
let r = await api('POST', '/api/auth/register', {
  isTutor: true,
  usuario: {
    email: 'maria@test.com', password: 'password123', dni: '12345678Z',
    nombre: 'Maria', apellidos: 'Lopez Garcia', telefono: '600111222',
    direccion: 'Calle Real 5', poblacion: 'Desamparados', codigoPostal: '03179'
  },
  hermano: {
    nombre: 'Pablito', apellidos: 'Lopez Perez', dni: '87654321X',
    fechaNacimiento: '2015-04-10'
  }
});
console.log('HTTP', r.status, JSON.stringify(r.json));

// ============ 2. LOGIN TUTOR: debe estar BLOQUEADO (pendiente) ============
step(2, 'Login de Maria ANTES de aprobacion (debe dar 403)');
r = await api('POST', '/api/auth/login', { email: 'maria@test.com', password: 'password123' });
console.log('HTTP', r.status, JSON.stringify(r.json));

// ============ 3. LOGIN ADMIN ============
step(3, 'Login del ADMIN de secretaria');
r = await api('POST', '/api/auth/login', { email: 'admin@cofradia.com', password: 'admin123' });
console.log('HTTP', r.status, '| role:', r.json?.user?.role);
const adminToken = r.json?.token;

// ============ 4. VER SOLICITUDES PENDIENTES ============
step(4, 'GET /admin/solicitudes (lista de pendientes)');
r = await api('GET', '/api/hermanos/admin/solicitudes', null, adminToken);
const maria = r.json?.data?.find(u => u.email === 'maria@test.com');
console.log('HTTP', r.status, '| Maria pendiente:', maria ? `id=${maria.id}, hijos=${maria.hermanos.length}` : 'NO ENCONTRADA');

// ============ 5. APROBAR SOLICITUD ============
step(5, `Aprobar solicitud de Maria (userId=${maria?.id})`);
r = await api('POST', `/api/hermanos/admin/solicitudes/${maria.id}/aprobar`, null, adminToken);
console.log('HTTP', r.status, JSON.stringify(r.json));

// ============ 6. LOGIN TUTOR: ahora OK ============
step(6, 'Login de Maria DESPUES de aprobacion');
r = await api('POST', '/api/auth/login', { email: 'maria@test.com', password: 'password123' });
console.log('HTTP', r.status, '| perfiles:', JSON.stringify(r.json?.user?.perfiles));
const tutorToken = r.json?.token;

// ============ 7. VER MIS PERFILES ============
step(7, 'GET /mis-perfiles (Maria ve a Pablito)');
r = await api('GET', '/api/hermanos/mis-perfiles', null, tutorToken);
console.log('HTTP', r.status, '| perfiles:', r.json?.map(h => `id=${h.id} ${h.nombre} (titular:${h.esTitular}, activo:${h.activo})`));
const pablitoId = r.json?.[0]?.id;

// ============ 8. AÑADIR SEGUNDO HIJO (sin DNI, menor) ============
step(8, 'POST /mis-perfiles (Maria añade a Nilita, SIN DNI)');
r = await api('POST', '/api/hermanos/mis-perfiles', {
  nombre: 'Nilita', apellidos: 'Lopez Perez', fechaNacimiento: '2018-06-20'
}, tutorToken);
console.log('HTTP', r.status, '| creada:', r.json?.id ? `id=${r.json.id} ${r.json.nombre} (activo:${r.json.activo})` : JSON.stringify(r.json));

// ============ 9. EMANCIPAR A PABLITO ============
step(9, `POST /mis-perfiles/${pablitoId}/emancipar (Pablito se independiza)`);
r = await api('POST', `/api/hermanos/mis-perfiles/${pablitoId}/emancipar`, {
  newEmail: 'pablito@test.com', newPassword: 'password123'
}, tutorToken);
console.log('HTTP', r.status, JSON.stringify(r.json)?.slice(0, 200));

// ============ 10. LOGIN DE PABLITO (cuenta nueva) ============
step(10, 'Login de Pablito con SU propia cuenta');
r = await api('POST', '/api/auth/login', { email: 'pablito@test.com', password: 'password123' });
console.log('HTTP', r.status, '| perfiles propios:', JSON.stringify(r.json?.user?.perfiles));
const pablitoToken = r.json?.token;

// ============ 11. PABLITO VE SOLO SU FICHA ============
step(11, 'GET /mis-perfiles (Pablito solo debe verse a si mismo)');
r = await api('GET', '/api/hermanos/mis-perfiles', null, pablitoToken);
console.log('HTTP', r.status, '| perfiles:', r.json?.map(h => `id=${h.id} ${h.nombre} (titular:${h.esTitular})`));

// ============ 12. MARIA YA NO VE A PABLITO ============
step(12, 'GET /mis-perfiles (Maria ya solo debe ver a Nilita)');
r = await api('GET', '/api/hermanos/mis-perfiles', null, tutorToken);
console.log('HTTP', r.status, '| perfiles:', r.json?.map(h => `id=${h.id} ${h.nombre}`));

// ============ 13. IDOR: Maria intenta editar la ficha de Pablito ============
step(13, `PUT /mis-perfiles/${pablitoId} (Maria intenta tocar la ficha de Pablito → debe dar 403)`);
r = await api('PUT', `/api/hermanos/mis-perfiles/${pablitoId}`, { telefono: '600999999' }, tutorToken);
console.log('HTTP', r.status, JSON.stringify(r.json));

console.log('\n========== FIN DE PRUEBAS ==========');
