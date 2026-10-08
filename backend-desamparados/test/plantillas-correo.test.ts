// Las plantillas de correo sin base de datos: el catálogo de usos es
// coherente, el formato se lee como se explica en el CMS, la revisión avisa
// de lo que dejaría un hueco y lo que escribe Secretaría se escapa.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { USOS, leerCuerpo, problemasDePlantilla, resumenDe, usoDe } from '../src/domain/plantillas-correo.js';
import { componer } from '../src/services/correos/componer.js';
import { PlantillasCorreoService } from '../src/services/plantillas-correo.service.js';
import { direccionDeLaSede, identidad, secretaria, type Identidad } from '../src/domain/datos-entidad.js';

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

  const corporacion = componer(pesame, {
    asunto: 'x', titulo: 'x',
    cuerpo: 'Bienvenido {{a_la_corporacion}}. Gracias por confiar en {{nuestra_corporacion}}; los datos {{de_la_corporacion_corto}}.',
    despedida: '',
  }).html;
  assert.match(corporacion, /Bienvenido al Grupo Parroquial\. Gracias por confiar en nuestro Grupo Parroquial; los datos del Grupo\./);

  const tienda = usoDe('pedido_tienda')!;
  const conBloque = componer(tienda, tienda.porDefecto, { campos: { nombre: 'Ana', numero: 7 }, bloques: { lineas: '<table id="lineas"></table>' } }).html;
  assert.match(conBloque, /<table id="lineas"><\/table>/);
  assert.match(conBloque, /pedido n\.º 7/);
});

test('el resumen del buzón es el primer párrafo que no es el saludo', () => {
  assert.equal(resumenDe('{{saludo}}\n\nYa está **abierta** la solicitud de {{anio}}.', { saludo: 'Estimado Juan:', anio: '2027' }), 'Ya está abierta la solicitud de 2027.');
});

// La vista previa la miran quienes escriben la plantilla: si los campos de la
// corporación salieran del `ejemplo` fijo del catálogo, otra instalación vería
// «al Grupo Parroquial» en su propio correo, y {{grupo}} y {{titular}}, que no
// tienen ejemplo, saldrían vacíos.
test('la vista previa rellena los campos de la corporación con la identidad de la instalación', () => {
  const texto = { asunto: '{{grupo}}', titulo: 'Bienvenido {{a_la_corporacion}}', cuerpo: 'Hola, {{nombre}}.', despedida: 'Que {{titular}} le guarde.' };
  const previa = PlantillasCorreoService.vistaPrevia('alta_aprobada', texto);
  assert.equal(previa.asunto, identidad.nombre);
  assert.match(previa.html, /Bienvenido al Grupo Parroquial/);
  assert.ok(previa.html.includes(`Que ${identidad.titular} le guarde.`), 'la titular no puede salir vacía');
  assert.match(previa.html, /Hola, Juan\./, 'los campos propios del uso siguen con su ejemplo');

  const hermandad: Identidad = { ...identidad, nombre: 'Hermandad de la Vera Cruz', tipo: 'Hermandad', tipoCorto: 'Hermandad', articulo: 'la', titular: 'Nuestro Padre Jesús de la Vera Cruz', descripcion: 'Hermandad de ejemplo, para las pruebas.' };
  const otra = PlantillasCorreoService.vistaPrevia('alta_aprobada', texto, hermandad);
  assert.equal(otra.asunto, 'Hermandad de la Vera Cruz');
  assert.match(otra.html, /Bienvenido a la Hermandad/);
  assert.ok(otra.html.includes('Que Nuestro Padre Jesús de la Vera Cruz le guarde.'));
  assert.doesNotMatch(otra.html, /Grupo/);
});

// Una vista previa que titula «Rosario vespertino» y luego habla «del Sábado
// de Pasión» hace dudar a quien la revisa de si el campo está bien puesto.
test('los ejemplos de los campos de la salida hablan de la misma salida', () => {
  for (const uso of USOS) {
    const ejemplo = (clave: string) => uso.campos.find((c) => c.clave === clave)?.ejemplo;
    const salida = ejemplo('salida');
    if (!salida) continue;
    for (const clave of ['de_la_salida', 'la_salida']) {
      const valor = ejemplo(clave);
      if (valor !== undefined) assert.ok(valor.endsWith(` ${salida}`), `${uso.clave}: ${clave} «${valor}» no es «${salida}»`);
    }
  }
});

// La dirección de Secretaría estaba escrita dos veces en shared/datos-entidad.json
// (en `secretaria` y en `sede`); ahora sale solo de la sede.
test('la dirección de Secretaría es la de la sede, en una línea', () => {
  assert.equal(direccionDeLaSede({ nombre: 'Iglesia', calle: 'C. Mayor, 3', codigoPostal: '29006', localidad: 'Málaga' }), 'C. Mayor, 3, 29006 Málaga');
  assert.equal(direccionDeLaSede({ nombre: null, calle: 'C. Mayor, 3', codigoPostal: null, localidad: 'Málaga' }), 'C. Mayor, 3, Málaga');
  assert.equal(direccionDeLaSede({ nombre: 'Iglesia', calle: null, codigoPostal: '29006', localidad: 'Málaga' }), null, 'sin calle no hay dirección');
  assert.match(String(secretaria.direccion), /\b\d{5}\b/, 'el código postal sigue ahí: de él sale la provincia del Modelo 182');
});
