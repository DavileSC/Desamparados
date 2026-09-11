import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContadorFallos, RegistroReciente } from '../src/utils/contador-fallos.js';

const MINUTO = 60_000;

/** Contador con reloj de mentira: los tests avanzan el tiempo a mano. */
function contador(opciones: Partial<ConstructorParameters<typeof ContadorFallos>[0]> = {}) {
  let ahora = 1_000_000;
  const c = new ContadorFallos({
    maxFallos: 3,
    bloqueoMs: 15 * MINUTO,
    ventanaMs: 60 * MINUTO,
    tope: 100,
    ahora: () => ahora,
    ...opciones
  });
  return { c, avanzar: (ms: number) => { ahora += ms; } };
}

test('bloquea al llegar al máximo de fallos y solo a esa clave', () => {
  const { c } = contador();
  c.registrarFallo('a');
  c.registrarFallo('a');
  assert.equal(c.restanteBloqueo('a'), 0, 'dos fallos de tres todavía no bloquean');
  c.registrarFallo('a');
  assert.equal(c.restanteBloqueo('a'), 15 * MINUTO);
  assert.equal(c.restanteBloqueo('b'), 0, 'otra clave no se entera');
});

test('el bloqueo se levanta al pasar su plazo', () => {
  const { c, avanzar } = contador();
  for (let i = 0; i < 3; i++) c.registrarFallo('a');
  avanzar(15 * MINUTO);
  assert.equal(c.restanteBloqueo('a'), 0);
});

test('un fallo más viejo que la ventana ya no suma', () => {
  const { c, avanzar } = contador();
  c.registrarFallo('a');
  c.registrarFallo('a');
  avanzar(61 * MINUTO);
  c.registrarFallo('a');
  assert.equal(c.restanteBloqueo('a'), 0, 'los dos primeros caducaron: van uno, no tres');
});

test('limpiar borra la cuenta de fallos', () => {
  const { c } = contador();
  c.registrarFallo('a');
  c.registrarFallo('a');
  c.limpiar('a');
  c.registrarFallo('a');
  assert.equal(c.restanteBloqueo('a'), 0);
  assert.equal(c.tamano, 1);
});

// El fallo de antes: cada email inventado dejaba una entrada para siempre.
test('las entradas caducadas se barren solas', () => {
  const { c, avanzar } = contador();
  for (let i = 0; i < 50; i++) c.registrarFallo(`email-${i}`);
  avanzar(61 * MINUTO);
  c.barrer();
  assert.equal(c.tamano, 0);
});

test('nunca pasa del tope aunque llegue una ráfaga de claves distintas', () => {
  const { c } = contador({ tope: 20 });
  for (let i = 0; i < 500; i++) c.registrarFallo(`inventado-${i}`);
  assert.ok(c.tamano <= 20, `hay ${c.tamano} entradas con tope 20`);
});

// Si el tope se llevara por delante un bloqueo vivo, inundar el mapa de emails
// inventados serviría para desbloquear la cuenta atacada.
test('al recortar por el tope se conservan los bloqueos vivos', () => {
  const { c } = contador({ tope: 20 });
  for (let i = 0; i < 3; i++) c.registrarFallo('cargo@ejemplo.test');
  for (let i = 0; i < 500; i++) c.registrarFallo(`inventado-${i}`);
  assert.ok(c.restanteBloqueo('cargo@ejemplo.test') > 0, 'el bloqueo del cargo no puede desaparecer por la ráfaga');
});

// Las redes desde las que cada cuenta ha entrado bien: el bloqueo global por
// email no se aplica a ellas.
test('el registro de redes confiadas caduca con su vigencia', () => {
  let ahora = 0;
  const r = new RegistroReciente({ vigenciaMs: 30 * MINUTO, tope: 100, ahora: () => ahora });
  r.apuntar('cuenta|red');
  assert.equal(r.tiene('cuenta|red'), true);
  assert.equal(r.tiene('cuenta|otra'), false);
  ahora += 31 * MINUTO;
  assert.equal(r.tiene('cuenta|red'), false);
  assert.equal(r.tamano, 0, 'lo caducado se va al consultarlo');
});

test('el registro de redes confiadas no pasa de su tope', () => {
  const r = new RegistroReciente({ vigenciaMs: 30 * MINUTO, tope: 10 });
  for (let i = 0; i < 100; i++) r.apuntar(`cuenta|red-${i}`);
  assert.ok(r.tamano <= 10);
  assert.equal(r.tiene('cuenta|red-99'), true, 'se conserva lo más reciente');
});
