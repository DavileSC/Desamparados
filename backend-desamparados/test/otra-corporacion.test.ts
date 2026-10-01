// La instalación de mentira: con una identidad «la Hermandad» en vez de «el
// Grupo Parroquial» (shared/datos-entidad.json), los textos que antes se
// escribían a mano tienen que seguir leyéndose bien y sin rastro de «Grupo».
//
// Las funciones de domain/articulos.ts ya se prueban contra
// shared/casos-articulos.json (test/articulos.test.ts); aquí se comprueban
// los sitios donde se montan textos enteros: el pie de los correos, dos
// correos que ya salen de una plantilla (alta aprobada y pésame) y la
// portada del Informe anual.
//
// `pie`, `maquetar`, `componer` y `textosPortada` aceptan la identidad por
// parámetro (con la de esta instalación por defecto) solo para esto: ningún
// sitio de producción la pasa.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Identidad } from '../src/domain/datos-entidad.js';
import { nuestraCorporacion } from '../src/domain/articulos.js';
import { maquetar, pie } from '../src/services/correos/plantilla.js';
import { componer, usoObligado } from '../src/services/correos/componer.js';
import { usoDe } from '../src/domain/plantillas-correo.js';
import { textosPortada } from '../src/services/informes/informes.js';

/** Una instalación que no es la de Desamparados: para que no cuele un «Grupo» escrito a mano. */
const HERMANDAD: Identidad = {
  nombre: 'Hermandad de la Vera Cruz', nombreCorto: 'Vera Cruz',
  tipo: 'Hermandad', tipoCorto: 'Hermandad', articulo: 'la',
  titular: 'Nuestro Padre Jesús de la Vera Cruz', localidad: 'Sevilla',
  dominio: 'www.veracruz.ejemplo', descripcion: 'Hermandad de ejemplo, para las pruebas.',
};

/** Ninguno de los textos que nombran la corporación puede decir «Grupo». */
const sinGrupo = (texto: string) => assert.doesNotMatch(texto, /Grupo/, texto);

describe('el pie de los correos', () => {
  test('el aviso interno dice «de la Hermandad»', () => {
    const texto = pie('interno', HERMANDAD);
    assert.match(texto, /Aviso automático de la web de la Hermandad para el buzón de Secretaría\./);
    sinGrupo(texto);
  });

  test('el de un hermano dice «la Hermandad»', () => {
    const texto = pie('hermano', HERMANDAD);
    assert.match(texto, /Recibe este correo por su relación con la Hermandad,/);
    sinGrupo(texto);
  });
});

describe('dos correos que ya salen de una plantilla', () => {
  test('alta aprobada: «a la Hermandad» en el título y «de la Hermandad» en el cuerpo', () => {
    const uso = usoObligado('alta_aprobada');
    const { html } = componer(uso, uso.porDefecto, {
      campos: { saludo: 'Estimado Juan:', nombre: 'Juan', bienvenido: 'Bienvenido', forma_parte: 'forma parte' },
      bloques: { censo: '<table id="censo"></table>', boton: '' },
      identidad: HERMANDAD,
    });
    assert.match(html, /Bienvenido a la Hermandad/);
    assert.match(html, /forma parte del censo de hermanos de la Hermandad/);
    sinGrupo(html);
  });

  test('pésame: «la Hermandad» acompaña, sin plantilla propia que lo tape', () => {
    const uso = usoDe('pesame')!;
    const { html } = componer(uso, uso.porDefecto, {
      campos: { difunto: 'Antonio Ruiz', hermano: 'hermano' },
      identidad: HERMANDAD,
    });
    assert.match(html, /les acompaña la Hermandad por el fallecimiento/);
    sinGrupo(html);
  });

  test('la maqueta entera (escudo, firma y pie de página) también deja de decir «Grupo»', () => {
    const html = maquetar({
      titulo: 'Prueba', antetitulo: 'Prueba', resumen: 'Prueba', contenido: '<p>Hola.</p>', identidad: HERMANDAD,
    });
    assert.match(html, /Escudo de la Hermandad/, 'el alt del escudo');
    assert.match(html, />Hermandad</, 'el rótulo bajo el escudo: identidad.tipo');
    assert.match(html, /Hermandad de la Vera Cruz &middot; Sevilla/, 'el pie con copyright');
    sinGrupo(html);
  });
});

describe('la portada del Informe anual', () => {
  // pdfkit comprime el contenido del PDF: no se puede leer el texto del
  // buffer, así que se prueba la función pura que calcula esos textos
  // (domain/articulos.ts ya prueba laCorporacion y compañía por su cuenta).
  test('dice «de la Hermandad», no «del Grupo Parroquial»', () => {
    const t = textosPortada(HERMANDAD);
    assert.equal(t.tipo, 'de la Hermandad');
    assert.equal(t.localidad, 'Sevilla');
    sinGrupo(t.tipo);
  });
});

test('la forma «nuestra Hermandad», la que usan las despedidas de las plantillas', () => {
  assert.equal(nuestraCorporacion({ identidad: HERMANDAD }), 'nuestra Hermandad');
});
