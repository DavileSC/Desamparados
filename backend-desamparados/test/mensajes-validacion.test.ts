import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type, ArkErrors } from 'arktype';
import { mensajeValidacion } from '../src/config/mensajes-validacion.js';
import { email, password, textoRequerido } from '../src/config/common.js';

/** Mensajes por campo, como los devuelve `validate`. */
function mensajes(esquema: (datos: unknown) => unknown, datos: unknown): Record<string, string> {
  const resultado = esquema(datos);
  assert.ok(resultado instanceof ArkErrors, 'los datos de prueba deben ser inválidos');
  return Object.fromEntries([...resultado].map((p) => [p.path.join('.'), mensajeValidacion(p)]));
}

test('traduce los tipos predefinidos de ArkType al español', () => {
  const esquema = type({
    texto: 'string', entero: 'number.integer', positivo: 'number > 0', minimo: 'number >= 5',
    maximo: 'number <= 1', largo: 'string >= 3', corto: 'string <= 2', sino: 'boolean', estado: "'PAGADO' | 'PENDIENTE'"
  });
  const m = mensajes(esquema, {
    texto: 3, entero: 1.5, positivo: 0, minimo: 1, maximo: 9, largo: 'ab', corto: 'abc', sino: 'x', estado: 'X'
  });

  assert.equal(m.texto, 'Debe ser un texto');
  assert.equal(m.entero, 'Debe ser un número entero');
  assert.equal(m.positivo, 'Debe ser mayor que cero');
  assert.equal(m.minimo, 'Debe ser 5 o más');
  assert.equal(m.maximo, 'Debe ser 1 o menos');
  assert.equal(m.largo, 'Debe ser de al menos 3 caracteres');
  assert.equal(m.corto, 'Debe ser de 2 caracteres como mucho');
  assert.equal(m.sino, 'Debe ser verdadero o falso');
  assert.equal(m.estado, 'Debe ser "PAGADO" o "PENDIENTE"');
});

test('un campo que falta es «obligatorio», no «debe ser un texto»', () => {
  const m = mensajes(type({ nombre: 'string' }), {});
  assert.equal(m.nombre, 'Es obligatorio');
});

test('las descripciones propias ya en español se respetan', () => {
  const m = mensajes(type({ email }), { email: 'no-es-un-correo' });
  assert.equal(m.email, 'Debe ser un email válido');
});

// Leer `expected` de un predicado rechazado con ctx.reject lanza: así tumbó
// con un 500 el restablecimiento de contraseña con una contraseña débil.
test('un predicado con motivo propio usa ese motivo y no revienta', () => {
  const m = mensajes(type({ newPassword: password }), { newPassword: '12345678' });
  assert.match(m.newPassword, /^La contraseña /);
});

test('un predicado sin descripción ni motivo propio no sale en inglés', () => {
  const m = mensajes(type({ codigo: type('string').narrow((s) => s === 'A') }), { codigo: 'B' });
  assert.equal(m.codigo, 'Debe ser un valor válido');
});

test('ningún mensaje conserva la ruta ni el valor recibido', () => {
  const m = mensajes(type({ body: { importe: 'number > 0' } }), { body: { importe: -1 } });
  assert.equal(m['body.importe'], 'Debe ser mayor que cero');
});

// Sin tope, un texto más largo que la columna (VARCHAR(191)) llegaba a la base
// y salía como 500; ahora lo para el esquema con su mensaje.
test('textoRequerido no pasa de 191 caracteres', () => {
  const esquema = type({ titulo: textoRequerido });
  assert.ok(!(esquema({ titulo: 'a'.repeat(191) }) instanceof ArkErrors));
  assert.match(mensajes(esquema, { titulo: 'a'.repeat(192) }).titulo, /191/);
});

// Un campo obligatorio vacío (o solo con espacios) decía «Debe ser un texto
// válido sin caracteres especiales (<, >)…», que hacía buscar un «<» que no
// estaba. El vacío lleva su propio mensaje; el de «<» y «>» no cambia.
test('textoRequerido vacío dice que no puede quedar vacío', () => {
  const esquema = type({ direccion: textoRequerido });
  assert.equal(mensajes(esquema, { direccion: '' }).direccion, 'No puede quedar vacío');
  assert.equal(mensajes(esquema, { direccion: '   ' }).direccion, 'No puede quedar vacío');
  assert.match(mensajes(esquema, { direccion: 'Calle <b>' }).direccion, /<, >/);
  assert.match(mensajes(esquema, { direccion: 'Calle <b>' }).direccion, /^Debe ser /);
});
