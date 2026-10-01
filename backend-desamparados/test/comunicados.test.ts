// Pruebas del boletín y los avisos (domain/comunicados.ts), sin base: un correo
// por dirección, el HTML del editor pasado a correo y el enlace de baja firmado.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { adaptarAlCorreo, describirSegmento, destinatariosDe, emailDeToken, tokenDeBaja } from '../src/domain/comunicados.js';

describe('a quién va', () => {
  test('un correo por dirección: la de la ficha, o la de la cuenta si no tiene', () => {
    const { destinatarios, sinCorreo } = destinatariosDe([
      { nombre: 'Ana', sexo: 'MUJER', email: 'Ana@Ejemplo.es', emailCuenta: 'familia@ejemplo.es' },
      { nombre: 'Luis', sexo: 'HOMBRE', email: null, emailCuenta: 'familia@ejemplo.es' },
      { nombre: 'Eva', sexo: 'MUJER', email: null, emailCuenta: 'familia@ejemplo.es' },
      { nombre: 'Pepe', sexo: null, email: null, emailCuenta: 'censo-importado@cuentas.invalido' },
    ]);
    assert.deepEqual(destinatarios, [
      { email: 'ana@ejemplo.es', nombre: 'Ana', sexo: 'MUJER' },
      // Dos fichas en la misma dirección: un correo, con saludo general.
      { email: 'familia@ejemplo.es', nombre: null, sexo: null },
    ]);
    assert.equal(sinCorreo, 1);
  });

  test('describe el segmento en castellano', () => {
    assert.equal(describirSegmento('BOLETIN', {}), 'Hermanos activos suscritos al boletín');
    assert.equal(
      describirSegmento('AVISO', { conPapeleta: 7, conDeuda: true, edad: 'MAYORES', poblacion: ' Málaga ' }, new Map([[7, 'Sábado de Pasión']])),
      'Hermanos activos · con papeleta del Sábado de Pasión · con cuotas pendientes · mayores de edad · de Málaga',
    );
  });
});

describe('el cuerpo en el correo', () => {
  test('estilos en línea y direcciones absolutas', () => {
    const html = adaptarAlCorreo(
      '<h2>Cultos</h2><p style="color:red">Ver <a href="/agenda">la agenda</a></p><img src="/storage/public/a.webp" alt="">',
      'https://desamparados.es', 'https://desamparados.es',
    );
    assert.match(html, /<h2 style="margin: 26px 0 12px 0;[^"]*">Cultos<\/h2>/);
    assert.ok(!html.includes('color:red'));
    assert.ok(html.includes('href="https://desamparados.es/agenda"'));
    assert.ok(html.includes('src="https://desamparados.es/storage/public/a.webp"'));
    assert.match(html, /<img src="[^"]+" alt="" style="display: block; max-width: 100%;/);
  });

  test('lo que ya es absoluto o un correo se deja igual', () => {
    const html = adaptarAlCorreo('<p><a href="mailto:a@b.es">a</a> <a href="https://otro.es/x">x</a></p>', 'https://w.es', 'https://w.es');
    assert.ok(html.includes('href="mailto:a@b.es"') && html.includes('href="https://otro.es/x"'));
  });
});

describe('la baja del boletín', () => {
  test('el enlace lleva la dirección firmada: cambiarla invalida la firma', () => {
    const token = tokenDeBaja(' Ana@Ejemplo.es ', 'secreto');
    assert.equal(emailDeToken(token, 'secreto'), 'ana@ejemplo.es');
    assert.equal(emailDeToken(token, 'otro secreto'), null);
    const [, firma] = token.split('.');
    assert.equal(emailDeToken(`${Buffer.from('otra@ejemplo.es').toString('base64url')}.${firma}`, 'secreto'), null);
    assert.equal(emailDeToken('basura', 'secreto'), null);
  });
});
