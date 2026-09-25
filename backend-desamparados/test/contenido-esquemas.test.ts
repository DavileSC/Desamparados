import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArkErrors } from 'arktype';
import topes from '../../shared/topes-contenido.json' with { type: 'json' };
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { porDefecto, type SlugContenido } from '../src/domain/contenido.js';

const valida = (slug: SlugContenido, datos: unknown) =>
  !(esquemaDeSlug(slug)(datos) instanceof ArkErrors);

test('los valores por defecto pasan su propio esquema', () => {
  // Si no pasaran, la siembra escribiría algo que el CMS no podría volver a guardar.
  assert.ok(valida('portada', porDefecto('portada')));
  // El recorrido dejó de tener forma propia: ahora es una página de bloques, y
  // sus paradas y su plano los validan el bloque de itinerario y el de foto
  // (`bloques-esquemas.test.ts`). Aquí se comprueba que el documento entero
  // sigue pasando, que es lo que la siembra escribe.
  assert.ok(valida('recorrido', porDefecto('recorrido')));
  // La galería del Sábado de Pasión es la que siembra fotos de partida.
  assert.ok(valida('sabado-de-pasion', porDefecto('sabado-de-pasion')));
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

/**
 * Historia pasó a ser una página de bloques: sus hitos los valida el bloque de
 * cronología (`bloques-esquemas.test.ts`). Aquí queda lo que es del documento
 * entero: que los valores de partida pasan, y la ceja y el fondo de su cabecera.
 */
const cronologiaDe = (datos: any) => datos.bloques.find((b: any) => b.tipo === 'cronologia');

test('los valores por defecto de la historia pasan su esquema', () => {
  assert.ok(valida('historia', porDefecto('historia')));
});

test('una foto de hito sin descripción no se guarda', () => {
  const datos = porDefecto('historia') as any;
  cronologiaDe(datos).hitos[1].foto = { url: '/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp', alt: '', pie: '' };
  assert.ok(!valida('historia', datos), 'una foto sin alt deja el hito a medias para quien use lector de pantalla');

  cronologiaDe(datos).hitos[1].foto.alt = 'Los hermanos en la misa de la parroquia';
  assert.ok(valida('historia', datos));
});

test('la foto de fondo puede no estar, y si está es del propio sitio', () => {
  const datos = porDefecto('historia') as any;
  datos.cabecera.foto = '';
  assert.ok(valida('historia', datos), 'sin foto, el fondo queda liso');

  datos.cabecera.foto = 'https://otro-sitio.example/foto.jpg';
  assert.ok(!valida('historia', datos));
});

test('la ceja de la cabecera es opcional y tiene el tope de una etiqueta', () => {
  const datos = porDefecto('historia') as any;
  delete datos.cabecera.ceja;
  assert.ok(valida('historia', datos), 'las demás páginas no llevan ceja');

  datos.cabecera.ceja = 'a'.repeat(topes.etiqueta + 1);
  assert.ok(!valida('historia', datos));
});
