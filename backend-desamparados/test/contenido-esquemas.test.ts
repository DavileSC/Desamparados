import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArkErrors } from 'arktype';
import topes from '../../shared/topes-contenido.json' with { type: 'json' };
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { porDefecto } from '../src/domain/contenido.js';

const valida = (slug: 'portada' | 'recorrido', datos: unknown) =>
  !(esquemaDeSlug(slug)(datos) instanceof ArkErrors);

test('los valores por defecto pasan su propio esquema', () => {
  // Si no pasaran, la siembra escribiría algo que el CMS no podría volver a guardar.
  assert.ok(valida('portada', porDefecto('portada')));
  assert.ok(valida('recorrido', porDefecto('recorrido')));
});

test('un título que no es texto se rechaza', () => {
  const datos = porDefecto('portada') as any;
  datos.hero.titulo = 42;
  assert.ok(!valida('portada', datos));
});

test('el texto no puede llevar etiquetas HTML', () => {
  // Acaba dentro de un <Typography>: sin esto, un <img onerror> guardado desde
  // el CMS sería XSS almacenado el día que alguien lo pinte con dangerouslySetInnerHTML.
  const datos = porDefecto('portada') as any;
  datos.hero.titulo = '<img src=x onerror=alert(1)>';
  assert.ok(!valida('portada', datos));
});

test('la foto tiene que ser una ruta del propio sitio', () => {
  const datos = porDefecto('portada') as any;
  datos.sabadoDePasion.imagenUrl = 'https://otro-sitio.example/foto.jpg';
  assert.ok(!valida('portada', datos), 'una URL externa acabaría en el src de una <img> de la portada');

  datos.sabadoDePasion.imagenUrl = '/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp';
  assert.ok(valida('portada', datos));
});

test('un plano sin descripción no se guarda', () => {
  const datos = porDefecto('recorrido') as any;
  datos.plano = { url: '/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp', alt: '' };
  assert.ok(!valida('recorrido', datos), 'un plano sin alt deja sin recorrido a quien use lector de pantalla');

  datos.plano.alt = 'Plano del recorrido por el centro de Málaga';
  assert.ok(valida('recorrido', datos));
});

test('sin plano, la descripción vacía es correcta', () => {
  const datos = porDefecto('recorrido') as any;
  datos.plano = { url: '', alt: '' };
  assert.ok(valida('recorrido', datos));
});

test('la hora de una parada tiene que parecer una hora', () => {
  const datos = porDefecto('recorrido') as any;
  datos.paradas = [{ hora: 'por la tarde', lugar: 'Plaza' }];
  assert.ok(!valida('recorrido', datos));

  datos.paradas = [{ hora: '17:30', lugar: 'Plaza' }];
  assert.ok(valida('recorrido', datos));
});

test('cada clase de texto acepta su tope justo y rechaza un carácter más', () => {
  // Los topes de `shared/topes-contenido.json` los repiten a mano los ~33
  // `maxLength` de las pantallas del CMS, que es lo único que avisa mientras se
  // escribe. Que el servidor corte de verdad en el límite no lo comprobaba
  // nada: se daba por hecho leyendo el esquema, y el esquema es justo lo que
  // este test tiene que vigilar.
  const casos: [keyof typeof topes, (datos: any, valor: string) => void][] = [
    ['etiqueta', (d, v) => { d.hero.ceja = v; }],
    ['titulo', (d, v) => { d.hero.titulo = v; }],
    ['parrafo', (d, v) => { d.hero.parrafo = v; }],
    ['descripcion', (d, v) => { d.sabadoDePasion.imagenAlt = v; }],
  ];

  for (const [clase, poner] of casos) {
    const tope = topes[clase];

    const justo = porDefecto('portada') as any;
    poner(justo, 'a'.repeat(tope));
    assert.ok(valida('portada', justo), `${clase}: ${tope} caracteres son el tope y tienen que pasar`);

    const pasado = porDefecto('portada') as any;
    poner(pasado, 'a'.repeat(tope + 1));
    assert.ok(!valida('portada', pasado), `${clase}: ${tope + 1} caracteres se pasan del tope y tienen que caer`);
  }
});

test('una lista de paradas vacía es correcta', () => {
  const datos = porDefecto('recorrido') as any;
  datos.paradas = [];
  assert.ok(valida('recorrido', datos), 'la página puede estar en preparación');
});
