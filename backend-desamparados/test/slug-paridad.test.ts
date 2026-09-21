import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { slugDeNoticia } from '../src/domain/slug-noticia.js';

// La misma tabla que lee desamparados-web/src/lib/__tests__/slug.test.ts.
// El CMS enseña la dirección mientras se escribe el título y este servicio la
// pone al guardar: son dos paquetes sin código compartido, y esta tabla es lo
// único que impide que la noticia acabe en una dirección distinta de la que el
// CMS prometió.
const { casos } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../shared/casos-slug.json', import.meta.url)), 'utf8')
) as { casos: { titulo: string; anio: number; slug: string }[] };

test('la dirección de una noticia es la misma que propone el CMS', () => {
  for (const { titulo, anio, slug } of casos) {
    assert.equal(slugDeNoticia(titulo, anio), slug, `«${titulo}» (${anio})`);
  }
});

test('un título sin letras ni cifras deja la dirección en solo el año', () => {
  // Aquí los dos lados se separan a propósito: el CMS no enseña «-2026» como
  // dirección propuesta. No llega a guardarse porque sin título no se guarda.
  assert.equal(slugDeNoticia('¿?', 2026), '-2026');
});
