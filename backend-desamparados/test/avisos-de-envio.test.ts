// Los avisos de Brevo, la clave que los protege y las cabeceras de la baja en
// un clic: todo puro, sin base de datos.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claveDelAvisoValida, leerAvisos } from '../src/domain/avisos-de-envio.js';
import { cabecerasDeBaja, emailDeToken } from '../src/domain/comunicados.js';
import { filtrosAvanzados } from '../src/domain/filtros-censo.js';

test('de los avisos de Brevo solo cuentan los que dicen que el correo no llega o que no lo quieren', () => {
  const avisos = leerAvisos([
    { event: 'hard_bounce', email: ' Ana@Ejemplo.TEST ', reason: '550 5.1.1 User unknown' },
    { event: 'invalid_email', email: 'mal@ejemplo.test' },
    { event: 'blocked', email: 'bloqueada@ejemplo.test' },
    { event: 'spam', email: 'queja@ejemplo.test' },
    { event: 'unsubscribed', email: 'baja@ejemplo.test' },
    // Lo que no se usa: entregas, aperturas, rebotes blandos (Brevo reintenta).
    { event: 'delivered', email: 'ok@ejemplo.test' },
    { event: 'soft_bounce', email: 'lleno@ejemplo.test' },
    { event: 'opened', email: 'ok@ejemplo.test' },
    // Lo que no se entiende, fuera sin error.
    { event: 'hard_bounce', email: 'sin-arroba' },
    { event: 'hard_bounce' },
    'texto',
    null,
  ]);
  assert.deepEqual(avisos, [
    { email: 'ana@ejemplo.test', motivo: 'REBOTE', bajaDelBoletin: false, detalle: '550 5.1.1 User unknown' },
    { email: 'mal@ejemplo.test', motivo: 'INVALIDO', bajaDelBoletin: false, detalle: null },
    { email: 'bloqueada@ejemplo.test', motivo: 'BLOQUEADO', bajaDelBoletin: false, detalle: null },
    { email: 'queja@ejemplo.test', motivo: 'SPAM', bajaDelBoletin: true, detalle: null },
    { email: 'baja@ejemplo.test', motivo: null, bajaDelBoletin: true, detalle: null },
  ]);
  // Un solo evento llega como objeto, no como lista.
  assert.equal(leerAvisos({ event: 'hard_bounce', email: 'uno@ejemplo.test' }).length, 1);
  assert.deepEqual(leerAvisos(undefined), []);
});

test('la clave del aviso vale como token o como contraseña, y nada más', () => {
  const clave = 'una-clave-larga-de-prueba-0123456789';
  const basic = (usuario: string, contrasena: string) => `Basic ${Buffer.from(`${usuario}:${contrasena}`).toString('base64')}`;
  assert.equal(claveDelAvisoValida(`Bearer ${clave}`, clave), true);
  assert.equal(claveDelAvisoValida(`bearer ${clave}`, clave), true);
  assert.equal(claveDelAvisoValida(basic('avisos', clave), clave), true);
  assert.equal(claveDelAvisoValida(basic('cualquiera', clave), clave), true);

  assert.equal(claveDelAvisoValida(undefined, clave), false);
  assert.equal(claveDelAvisoValida('', clave), false);
  assert.equal(claveDelAvisoValida(`Bearer ${clave}x`, clave), false);
  assert.equal(claveDelAvisoValida(basic(clave, 'otra'), clave), false);
  assert.equal(claveDelAvisoValida(`Basic ${Buffer.from(clave).toString('base64')}`, clave), false);
  assert.equal(claveDelAvisoValida(clave, clave), false);
  // Sin clave configurada, ni siquiera una cabecera vacía entra.
  assert.equal(claveDelAvisoValida('Bearer ', ''), false);
});

test('la baja en un clic apunta a la API con el enlace firmado de esa dirección', () => {
  const secreto = 'secreto-de-prueba';
  const cabeceras = cabecerasDeBaja('Ana@Ejemplo.test', secreto, 'https://desamparados.test/');
  assert.equal(cabeceras['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  const url = /^<(.+)>$/.exec(cabeceras['List-Unsubscribe'])?.[1];
  assert.ok(url?.startsWith('https://desamparados.test/api/boletin/baja-directa?t='), url);
  assert.equal(emailDeToken(new URL(url!).searchParams.get('t')!, secreto), 'ana@ejemplo.test');
});

test('el filtro «correo que rebota» busca la dirección de la ficha o, sin ella, la de su cuenta', () => {
  const [condicion] = filtrosAvanzados({ correo: 'rebota' }, new Date(), ['ana@ejemplo.test']);
  assert.deepEqual(condicion, {
    OR: [
      { email: { in: ['ana@ejemplo.test'] } },
      { AND: [{ OR: [{ email: null }, { email: '' }] }, { user: { email: { in: ['ana@ejemplo.test'] } } }] },
    ],
  });
});
