// Las plantillas de correo sin base de datos: el catálogo de usos es
// coherente, el formato se lee como se explica en el CMS, la revisión avisa
// de lo que dejaría un hueco y lo que escribe Secretaría se escapa.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { USOS, leerCuerpo, problemasDePlantilla, resumenDe, usoDe } from '../src/domain/plantillas-correo.js';
import { componer } from '../src/services/correos/componer.js';

test('cada texto original del catálogo es una plantilla válida de su uso', () => {
  const claves = USOS.map((u) => u.clave);
  assert.equal(new Set(claves).size, claves.length, 'claves repetidas');
  for (const uso of USOS) {
    if (uso.libre) continue;
    assert.deepEqual(problemasDePlantilla(uso, uso.porDefecto), [], uso.clave);
  }
});

test('el formato: párrafos, negrita, listas, recuadros con título y bloques fijos', () => {
  assert.deepEqual(leerCuerpo('Hola, {{nombre}}:\nsegunda línea\n\n- uno\n- dos\n\n> **Antes de salir**\n> Puntualidad.\n\n[[papeleta]]'), [
    { tipo: 'parrafo', lineas: ['Hola, {{nombre}}:', 'segunda línea'] },
    { tipo: 'lista', elementos: ['uno', 'dos'] },
    { tipo: 'recuadro', titulo: 'Antes de salir', bloques: [{ tipo: 'parrafo', lineas: ['Puntualidad.'] }] },
    { tipo: 'fijo', clave: 'papeleta' },
  ]);
});

test('la revisión avisa de campos y bloques que el correo no tiene y de los obligatorios que faltan', () => {
  const papeleta = usoDe('papeleta')!;
  const problemas = problemasDePlantilla(papeleta, { asunto: 'Papeleta {{anio}}', titulo: 'Papeleta', cuerpo: 'Hola {{nombr}}\n\n[[recibo]]', despedida: '' });
  assert.ok(problemas.includes('Este correo no tiene el campo {{nombr}}.'));
  assert.ok(problemas.includes('Este correo no tiene el bloque [[recibo]].'));
  assert.ok(problemas.some((p) => p.startsWith('Falta el bloque [[papeleta]]')));
  assert.ok(problemasDePlantilla(papeleta, { ...papeleta.porDefecto, cuerpo: 'Su sitio: [[papeleta]]' }).includes('Cada bloque [[…]] va solo, en su propia línea.'));
  assert.deepEqual(problemasDePlantilla(papeleta, { asunto: ' ', titulo: '', cuerpo: '', despedida: '' }).slice(0, 3), ['Falta el asunto.', 'Falta el título.', 'Falta el texto.']);
});

test('componer: campos rellenos y escapados, bloques en su sitio, firma del cargo y asunto en texto', () => {
  const pesame = usoDe('pesame')!;
  const { asunto, html } = componer(pesame, {
    asunto: 'Pésame por {{difunto}}', titulo: 'En memoria', cuerpo: 'Por **{{difunto}}**, {{hermano}}.\n\n<script>alert(1)</script>', despedida: 'Descanse en paz.',
  }, { campos: { difunto: "José O'Brien <b>", hermano: 'hermano' } });
  assert.equal(asunto, "Pésame por José O'Brien <b>", 'el asunto es texto: no se escapa');
  assert.match(html, /Por <strong>José O&#39;Brien &lt;b&gt;<\/strong>, hermano\./);
  assert.ok(!html.includes('<script>'), 'lo que escribe Secretaría no entra como HTML');
  assert.match(html, /Descanse en paz\./);
  assert.match(html, /La Secretaría/);

  const tienda = usoDe('pedido_tienda')!;
  const conBloque = componer(tienda, tienda.porDefecto, { campos: { nombre: 'Ana', numero: 7 }, bloques: { lineas: '<table id="lineas"></table>' } }).html;
  assert.match(conBloque, /<table id="lineas"><\/table>/);
  assert.match(conBloque, /pedido n\.º 7/);
});

test('el resumen del buzón es el primer párrafo que no es el saludo', () => {
  assert.equal(resumenDe('{{saludo}}\n\nYa está **abierta** la solicitud de {{anio}}.', { saludo: 'Estimado Juan:', anio: '2027' }), 'Ya está abierta la solicitud de 2027.');
});
