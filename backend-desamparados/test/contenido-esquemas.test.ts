import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArkErrors } from 'arktype';
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

test('una lista de paradas vacía es correcta', () => {
  const datos = porDefecto('recorrido') as any;
  datos.paradas = [];
  assert.ok(valida('recorrido', datos), 'la página puede estar en preparación');
});
