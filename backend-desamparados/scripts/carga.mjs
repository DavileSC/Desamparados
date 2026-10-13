// Pruebas de carga contra la web de pruebas (docs/servidor.md, traspaso del
// 05-10-2026). En Node y sin dependencias nuevas porque en el PC no hay k6;
// sharp ya está en el backend y genera fotos que de verdad cuestan de procesar.
//
// Uso, desde backend-desamparados:
//   node --env-file=%USERPROFILE%\carga.env scripts/carga.mjs [opciones]
//
// El fichero de credenciales lo escribe el usuario y nunca entra en el
// repositorio ni en el chat:
//   CARGA_BASE=https://pruebas.desamparadosmalaga.com
//   CARGA_PUERTA_USUARIO=carga
//   CARGA_PUERTA_CLAVE=...
//   CARGA_CMS_EMAIL=...
//   CARGA_CMS_CLAVE=...
//   CARGA_CMS_TOTP=...      (solo si la cuenta tiene 2FA: el secreto en base32)
//
// Opciones:
//   --fases lectura,subidas,mesa   qué se prueba y en qué orden
//   --usuarios 10,25,50,100        escalones de la lectura pública
//   --usuarios-subidas 1,3,6       escalones de las subidas (pocos editores)
//   --usuarios-mesa 4,8,16         puestos de la mesa (cada uno con su SSE)
//   --duracion 150                 segundos de cada escalón
//   --pausa 2                      segundos medios entre páginas de un visitante
//   --sin-fotos                    la lectura sin fotos: el tope de la API sin el de la red
//   --parar-si 5,3000              deja de subir si un escalón pasa del 5 % de errores
//                                  o de 3000 ms de p95 en la API (para buscar el techo)
//   --salida resultado.json        dónde dejar los números

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values: op } = parseArgs({
  options: {
    fases: { type: 'string', default: 'lectura,subidas,mesa' },
    usuarios: { type: 'string', default: '10,25,50,100' },
    'usuarios-subidas': { type: 'string', default: '1,3,6' },
    'usuarios-mesa': { type: 'string', default: '4,8,16' },
    duracion: { type: 'string', default: '150' },
    pausa: { type: 'string', default: '2' },
    'sin-fotos': { type: 'boolean', default: false },
    'parar-si': { type: 'string' },
    salida: { type: 'string', default: 'carga-resultado.json' },
  },
});

const BASE = (process.env.CARGA_BASE ?? '').replace(/\/+$/, '');
if (!BASE) salir('Falta CARGA_BASE en el fichero de credenciales.');
// Nunca contra el dominio principal: allí acabará la web de verdad.
if (!/\/\/pruebas\./.test(BASE) && !/localhost|127\.0\.0\.1/.test(BASE)) {
  salir(`CARGA_BASE (${BASE}) no es la web de pruebas ni local.`);
}

const lista = (s) => s.split(',').map((x) => Number(x.trim())).filter((n) => n > 0);
const DURACION_MS = Number(op.duracion) * 1000;
const PAUSA_MS = Number(op.pausa) * 1000;

const puerta = process.env.CARGA_PUERTA_USUARIO
  ? 'Basic ' + Buffer.from(`${process.env.CARGA_PUERTA_USUARIO}:${process.env.CARGA_PUERTA_CLAVE ?? ''}`).toString('base64')
  : null;

function salir(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// Pausa con algo de azar: visitantes al compás harían picos que no existen.
const pausaVisitante = () => dormir(PAUSA_MS * (0.5 + Math.random()));

// ---------------------------------------------------------------- medidas

/** Una medida por escalón: latencias por grupo de peticiones y errores. */
class Medida {
  constructor(nombre) {
    this.nombre = nombre;
    this.inicio = new Date();
    this.fin = null;
    this.grupos = new Map();
  }
  apuntar(grupo, ms, estado, bytes = 0) {
    let g = this.grupos.get(grupo);
    if (!g) this.grupos.set(grupo, (g = { tiempos: [], errores: {}, bytes: 0 }));
    g.tiempos.push(ms);
    g.bytes += bytes;
    const ok = typeof estado === 'number' && estado < 400;
    if (!ok) g.errores[estado] = (g.errores[estado] ?? 0) + 1;
  }
  cerrar() {
    this.fin = new Date();
  }
  resumen() {
    const seg = ((this.fin ?? new Date()) - this.inicio) / 1000;
    const grupos = {};
    let total = 0;
    let fallos = 0;
    let bytes = 0;
    for (const [nombre, g] of this.grupos) {
      const t = [...g.tiempos].sort((a, b) => a - b);
      const p = (q) => (t.length ? Math.round(t[Math.min(t.length - 1, Math.floor(q * t.length))]) : null);
      const errores = Object.values(g.errores).reduce((a, b) => a + b, 0);
      total += t.length;
      fallos += errores;
      bytes += g.bytes;
      grupos[nombre] = { n: t.length, porSegundo: +(t.length / seg).toFixed(1), mbps: +((g.bytes * 8) / seg / 1e6).toFixed(1), p50: p(0.5), p95: p(0.95), p99: p(0.99), max: p(1), errores: g.errores };
    }
    return {
      escalon: this.nombre,
      inicioUTC: this.inicio.toISOString(),
      finUTC: this.fin?.toISOString(),
      segundos: Math.round(seg),
      peticiones: total,
      porSegundo: +(total / seg).toFixed(1),
      tasaError: total ? +((100 * fallos) / total).toFixed(2) : 0,
      // Megabits por segundo bajados: con fotos, la conexión (la de casa o la
      // del VPS) puede ser el tope antes que la CPU, y hay que saber cuál fue.
      mbps: +((bytes * 8) / seg / 1e6).toFixed(1),
      grupos,
    };
  }
}

function pintar(r) {
  console.log(`\n── ${r.escalon}  (${r.inicioUTC.slice(11, 19)}–${r.finUTC?.slice(11, 19)} UTC)  ${r.peticiones} pet., ${r.porSegundo}/s, ${r.mbps} Mbit/s, errores ${r.tasaError} %`);
  console.log('   grupo                    n      /s  Mbit/s     p50     p95     p99     max  errores');
  for (const [nombre, g] of Object.entries(r.grupos)) {
    const err = Object.entries(g.errores).map(([k, v]) => `${k}×${v}`).join(' ') || '—';
    console.log(`   ${nombre.padEnd(20)} ${String(g.n).padStart(6)} ${String(g.porSegundo).padStart(7)} ${String(g.mbps).padStart(7)} ${String(g.p50).padStart(7)} ${String(g.p95).padStart(7)} ${String(g.p99).padStart(7)} ${String(g.max).padStart(7)}  ${err}`);
  }
}

// ---------------------------------------------------------------- peticiones

let cookieCms = null;
let reentradas = 0;
let reentrando = null;

/**
 * Si la sesión se corta a mitad (alguien cierra la del CMS con la misma
 * cuenta, por ejemplo), se vuelve a entrar una vez para todos los que la
 * pedían a la vez. Con tope: el límite de accesos es de 20 cada 15 minutos.
 */
async function reentrar(cookieQueFallo) {
  if (cookieCms !== cookieQueFallo) return true;
  if (!reentrando) {
    if (reentradas >= 5) return false;
    reentradas++;
    console.log(`  ↻ La sesión del CMS se ha cortado: se vuelve a entrar (${reentradas}/5)`);
    reentrando = entrarEnCms().finally(() => { reentrando = null; });
  }
  await reentrando;
  return true;
}

/**
 * Una petición medida. Se lee el cuerpo entero: sin leerlo, la latencia no
 * incluye la transferencia y la conexión no vuelve al grupo.
 */
async function pedir(medida, grupo, ruta, { metodo = 'GET', cuerpo, cabeceras = {}, sesion = false, json = false, timeout = 60_000 } = {}) {
  const h = { 'user-agent': 'desamparados-carga/1', ...cabeceras };
  if (puerta) h.authorization = puerta;
  if (sesion && cookieCms) h.cookie = cookieCms;
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + ruta, { method: metodo, body: cuerpo, headers: h, signal: AbortSignal.timeout(timeout) });
    const buf = await res.arrayBuffer();
    if (sesion && res.status === 401 && cookieCms && (await reentrar(h.cookie))) {
      return pedir(medida, grupo, ruta, { metodo, cuerpo, cabeceras, sesion, json, timeout });
    }
    medida?.apuntar(grupo, performance.now() - t0, res.status, buf.byteLength);
    if (json && res.ok) {
      try {
        return { estado: res.status, datos: JSON.parse(Buffer.from(buf).toString('utf8')), res };
      } catch {
        return { estado: res.status, datos: null, res };
      }
    }
    return { estado: res.status, texto: json ? null : Buffer.from(buf).toString('utf8'), res };
  } catch (e) {
    const tipo = e?.name === 'TimeoutError' ? 'timeout' : (e?.cause?.code ?? 'red');
    medida?.apuntar(grupo, performance.now() - t0, tipo);
    return { estado: tipo };
  }
}

// ---------------------------------------------------------------- inicio de sesión

/** TOTP de RFC 6238 (SHA-1, 30 s, 6 cifras), como el que valida la API. */
function totp(secretoBase32) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretoBase32.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()) {
    const v = alfabeto.indexOf(c);
    if (v < 0) salir('CARGA_CMS_TOTP no es base32.');
    bits += v.toString(2).padStart(5, '0');
  }
  const clave = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = crypto.createHmac('sha1', clave).update(contador).digest();
  const o = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const cookieDe = (res, nombre) =>
  res.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith(nombre + '='));

/**
 * Un único inicio de sesión para todo el guion: el límite de los accesos es de
 * 20 por IP cada 15 minutos y no lo levanta LIMITE_GLOBAL_POR_IP.
 */
async function entrarEnCms() {
  const email = process.env.CARGA_CMS_EMAIL;
  const password = process.env.CARGA_CMS_CLAVE;
  if (!email || !password) salir('Faltan CARGA_CMS_EMAIL y CARGA_CMS_CLAVE para las subidas y la mesa.');
  const r = await pedir(null, '', '/api/auth/login', {
    metodo: 'POST',
    cuerpo: JSON.stringify({ email, password, contexto: 'cms' }),
    cabeceras: { 'content-type': 'application/json' },
    json: true,
  });
  if (r.estado !== 200) salir(`El acceso al CMS respondió ${r.estado}.`);
  if (r.datos?.status === '2FA_NEEDED') {
    if (!process.env.CARGA_CMS_TOTP) salir('La cuenta pide 2FA: añade CARGA_CMS_TOTP o usa otra cuenta.');
    const pendiente = cookieDe(r.res, 'desamparados_2fa');
    const r2 = await pedir(null, '', '/api/auth/login/2fa', {
      metodo: 'POST',
      cuerpo: JSON.stringify({ token2fa: totp(process.env.CARGA_CMS_TOTP) }),
      cabeceras: { 'content-type': 'application/json', cookie: pendiente },
      json: true,
    });
    if (r2.estado !== 200) salir(`El segundo paso respondió ${r2.estado}.`);
    cookieCms = cookieDe(r2.res, 'desamparados_cms');
  } else {
    cookieCms = cookieDe(r.res, 'desamparados_cms');
  }
  if (!cookieCms) salir('El acceso no devolvió la cookie del CMS.');
  console.log(`✓ Dentro del CMS como ${email.replace(/(.).*@/, '$1…@')}`);
}

// ---------------------------------------------------------------- lectura pública

/** Lo que pide la portada al cargar, tal como lo pide la web. */
const API_PORTADA = ['/api/portada', '/api/news/latest', '/api/events', '/api/publications/latest', '/api/salidas/proxima', '/api/modulos'];

/** Fotos y ficheros de la web, sacados de la portada real antes de empezar. */
const recursos = { assets: [], fotos: [], noticias: [] };

async function descubrir() {
  const html = await pedir(null, '', '/');
  if (html.estado !== 200) salir(`La portada respondió ${html.estado}: ¿usuario y clave de la puerta bien puestos?`);
  recursos.assets = [...new Set(html.texto.match(/\/assets\/[^"'\s)]+/g) ?? [])];
  // Las fotos salen de los JSON de la API: van con ruta /storage/public/…
  const fotos = new Set();
  for (const ruta of [...API_PORTADA, '/api/news/archive?page=1&limit=20']) {
    const r = await pedir(null, '', ruta);
    for (const m of r.texto?.match(/\/storage\/public\/[A-Za-z0-9._/-]+/g) ?? []) fotos.add(m);
    if (ruta.startsWith('/api/news/archive')) {
      for (const m of r.texto?.match(/"slug":"([^"]+)"/g) ?? []) recursos.noticias.push(m.slice(8, -1));
    }
  }
  recursos.fotos = [...fotos];
  console.log(`✓ Portada leída: ${recursos.assets.length} assets, ${recursos.fotos.length} fotos, ${recursos.noticias.length} noticias`);
}

const alAzar = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * Un visitante: entra por la portada (con sus assets la primera vez, como un
 * navegador sin caché) y luego va a noticias, la agenda o una página.
 */
async function visitante(medida, hasta) {
  let primera = true;
  while (Date.now() < hasta) {
    await pedir(medida, 'html', '/');
    if (primera) {
      await Promise.all(recursos.assets.map((a) => pedir(medida, 'assets', a)));
      primera = false;
    }
    await Promise.all(API_PORTADA.map((r) => pedir(medida, 'api portada', r)));
    // Lo que se ve de la portada: unas cuantas fotos, no todas.
    const fotos = op['sin-fotos'] ? [] : [...recursos.fotos].sort(() => Math.random() - 0.5).slice(0, 6);
    await Promise.all(fotos.map((f) => pedir(medida, 'fotos', f)));
    await pausaVisitante();
    if (Date.now() >= hasta) break;

    const destino = Math.random();
    if (destino < 0.5 && recursos.noticias.length) {
      await pedir(medida, 'api noticias', '/api/news/archive?page=1&limit=10');
      await pedir(medida, 'api noticias', `/api/news/${encodeURIComponent(alAzar(recursos.noticias))}`);
    } else if (destino < 0.8) {
      await pedir(medida, 'api agenda', '/api/events');
    } else {
      await pedir(medida, 'api páginas', alAzar(['/api/contenido/historia', '/api/contenido/parroquia']));
    }
    await pausaVisitante();
  }
}

// ---------------------------------------------------------------- subidas

/**
 * Foto de móvil de ~3 MB hecha de ruido: no comprime, así que sharp y ClamAV
 * trabajan como con una de verdad. Bajo el tope de 5 MB de las imágenes.
 */
async function prepararFicheros() {
  const { default: sharp } = await import('sharp');
  const ancho = 2600, alto = 1950;
  const ruido = crypto.randomBytes(ancho * alto * 3);
  const foto = await sharp(ruido, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
  if (foto.length > 5 * 1024 * 1024) salir(`La foto de prueba pesa ${foto.length} bytes, más del tope.`);
  // PDF de ~15 MB (tope 20): un flujo binario grande que ClamAV recorre entero.
  const relleno = crypto.randomBytes(15 * 1024 * 1024);
  const cabeza = Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n3 0 obj<</Length ${relleno.length}>>stream\n`);
  const cola = Buffer.from('\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const pdf = Buffer.concat([cabeza, relleno, cola]);
  console.log(`✓ Ficheros de prueba: foto ${(foto.length / 1e6).toFixed(1)} MB, PDF ${(pdf.length / 1e6).toFixed(1)} MB`);
  return { foto, pdf };
}

let ficheros = null;
let subidasHechas = 0;

/** Un editor: sube fotos y, una de cada cinco veces, un PDF grande. */
async function editor(medida, hasta) {
  while (Date.now() < hasta) {
    const esPdf = Math.random() < 0.2;
    const form = new FormData();
    form.append('file', new Blob([esPdf ? ficheros.pdf : ficheros.foto], { type: esPdf ? 'application/pdf' : 'image/jpeg' }), esPdf ? 'carga.pdf' : 'carga.jpg');
    const r = await pedir(medida, esPdf ? 'subida pdf' : 'subida foto', '/api/upload/public', { metodo: 'POST', cuerpo: form, sesion: true, timeout: 180_000 });
    if (typeof r.estado === 'number' && r.estado < 300) subidasHechas++;
    // Un editor no sube sin parar: elige la siguiente foto.
    await dormir(1000 + Math.random() * 2000);
  }
}

// ---------------------------------------------------------------- mesa de procesión

let salidaMesa = null;

/**
 * Un puesto de la mesa: deja abierto el canal SSE, como la pantalla, y lee las
 * colas y la lista igual que cuando alguien busca a un hermano.
 */
async function puestoMesa(medida, hasta) {
  const ctrl = new AbortController();
  const h = { accept: 'text/event-stream', cookie: cookieCms };
  if (puerta) h.authorization = puerta;
  const t0 = performance.now();
  // El canal se mide aparte: lo que importa es que abra y aguante.
  const canal = fetch(`${BASE}/api/procesion/admin/mesa/eventos`, { headers: h, signal: ctrl.signal })
    .then(async (res) => {
      medida.apuntar('sse abrir', performance.now() - t0, res.status);
      for await (const _ of res.body) { /* basta con vaciarlo */ }
      if (Date.now() < hasta) medida.apuntar('sse cortado', 0, 'cortado');
    })
    .catch((e) => {
      if (e?.name !== 'AbortError') medida.apuntar('sse cortado', 0, e?.cause?.code ?? 'red');
    });
  const s = encodeURIComponent(salidaMesa);
  const letras = 'aeimorsl';
  while (Date.now() < hasta) {
    await pedir(medida, 'mesa colas', `/api/procesion/admin/mesa/colas?salida=${s}`, { sesion: true });
    await pedir(medida, 'mesa buscar', `/api/procesion/admin/mesa/personas?salida=${s}&zona=todas&q=${alAzar([...letras])}${alAzar([...letras])}`, { sesion: true });
    await pedir(medida, 'mesa lista', `/api/procesion/admin/mesa/apuntados?salida=${s}`, { sesion: true });
    await dormir(2000 + Math.random() * 2000);
  }
  ctrl.abort();
  await canal;
}

// ---------------------------------------------------------------- escalones

async function escalon(nombre, usuarios, trabajo) {
  const medida = new Medida(`${nombre} · ${usuarios} a la vez`);
  const hasta = Date.now() + DURACION_MS;
  console.log(`\n▶ ${medida.nombre} durante ${DURACION_MS / 1000} s…`);
  // Entran escalonados en los primeros segundos, no todos en el mismo milisegundo.
  await Promise.all(Array.from({ length: usuarios }, async (_, i) => {
    await dormir((i * 5000) / usuarios);
    await trabajo(medida, hasta);
  }));
  medida.cerrar();
  const r = medida.resumen();
  pintar(r);
  // Respiro entre escalones para que el CSV del servidor los separe bien.
  await dormir(15_000);
  return r;
}

/** Buscando el techo: pasado este punto, más visitantes solo castigan al servidor. */
function pasaDelTope(r) {
  if (!op['parar-si']) return false;
  const [maxError, maxP95] = op['parar-si'].split(',').map(Number);
  const p95 = r.grupos['api portada']?.p95 ?? 0;
  if (r.tasaError > maxError || p95 > maxP95) {
    console.log(`
■ Tope alcanzado: ${r.tasaError} % de errores, p95 de la API ${p95} ms. No se sube más.`);
    return true;
  }
  return false;
}

const fases = op.fases.split(',').map((f) => f.trim());
const resultados = [];

await descubrir();
if (fases.includes('subidas') || fases.includes('mesa')) await entrarEnCms();
if (fases.includes('mesa')) {
  // Las salidas piden sesión: se leen como las lee la mesa, desde el CMS.
  const r = await pedir(null, '', '/api/cms/salidas', { json: true, sesion: true });
  salidaMesa = r.datos?.find?.((s) => s.activa)?.slug ?? r.datos?.[0]?.slug;
  if (!salidaMesa) salir('No hay ninguna salida activa para la mesa.');
  console.log(`✓ Mesa con la salida «${salidaMesa}»`);
}
if (fases.includes('subidas')) ficheros = await prepararFicheros();

for (const fase of fases) {
  if (fase === 'lectura') {
    for (const n of lista(op.usuarios)) {
      const r = await escalon(op['sin-fotos'] ? 'Lectura sin fotos' : 'Lectura pública', n, visitante);
      resultados.push(r);
      if (pasaDelTope(r)) break;
    }
  }
  else if (fase === 'subidas') for (const n of lista(op['usuarios-subidas'])) resultados.push(await escalon('Subidas al CMS', n, editor));
  else if (fase === 'mesa') for (const n of lista(op['usuarios-mesa'])) resultados.push(await escalon('Mesa de procesión', n, puestoMesa));
  else salir(`Fase desconocida: ${fase}`);
}

await fs.writeFile(op.salida, JSON.stringify({ base: BASE, duracionEscalon: DURACION_MS / 1000, pausa: PAUSA_MS / 1000, subidasHechas, reentradas, resultados }, null, 2));
console.log(`\n✓ Hecho. ${subidasHechas} subidas de prueba que limpiar. Números en ${op.salida}`);
