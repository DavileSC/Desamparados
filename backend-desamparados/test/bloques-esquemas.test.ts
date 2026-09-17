import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import { esquemaDeBloque } from '../src/schemas/bloques.schema.js';
import { TIPOS_BLOQUE } from '../src/domain/bloques.js';

const falla = (tipo: 'texto' | 'foto' | 'tarjetas', valor: unknown) =>
  esquemaDeBloque(tipo)(valor) instanceof ArkErrors;

describe('el mapa de esquemas cubre el catálogo', () => {
  // `TipoBloque` es `string` a ojos del compilador (ver Tarea 1), así que
  // TypeScript no avisaría si este mapa se quedara corto al añadir un tipo al
  // catálogo. Lo vigila este test: sin él, un bloque nuevo daría un 500 al
  // guardar en vez de validarse.
  test('hay un esquema para cada tipo declarado', () => {
    for (const tipo of TIPOS_BLOQUE) {
      assert.ok(esquemaDeBloque(tipo as never), `falta el esquema del bloque «${tipo}»`);
    }
  });
});

describe('bloque de texto', () => {
  test('acepta el HTML que produce el editor', () => {
    assert.ok(!falla('texto', { tipo: 'texto', titulo: '', html: '<p>Hola</p><ul><li>Uno</li></ul>' }));
  });

  test('acepta un título de sección opcional', () => {
    assert.ok(!falla('texto', { tipo: 'texto', titulo: 'Explora la sección', html: '<p>Hola</p>' }));
  });

  test('rechaza un cuerpo vacío: un bloque sin nada no pinta nada', () => {
    assert.ok(falla('texto', { tipo: 'texto', titulo: '', html: '' }));
  });
});

describe('bloque de foto', () => {
  const FOTO = { tipo: 'foto', titulo: '', url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', alt: 'La Virgen', pie: '' };

  test('acepta una foto nuestra con su descripción', () => {
    assert.ok(!falla('foto', FOTO));
  });

  test('rechaza una foto de fuera: filtraría la IP de quien visita', () => {
    assert.ok(falla('foto', { ...FOTO, url: 'https://ejemplo.test/foto.jpg' }));
  });

  test('rechaza una foto sin descripción', () => {
    assert.ok(falla('foto', { ...FOTO, alt: '' }));
    assert.ok(falla('foto', { ...FOTO, alt: '   ' }));
  });
});

describe('bloque de tarjetas', () => {
  const TARJETA = { titulo: 'Historia', descripcion: 'Orígenes del Grupo Parroquial.', enlace: '/corporacion/historia' };
  const doc = (tarjetas: unknown[]) => ({ tipo: 'tarjetas', titulo: 'Explora la sección', tarjetas });

  test('acepta tarjetas con enlace interno', () => {
    assert.ok(!falla('tarjetas', doc([TARJETA])));
  });

  test('rechaza un enlace que se va fuera del sitio', () => {
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: 'https://otro.test' }])));
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: 'javascript:alert(1)' }])));
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: '//otro.test' }])),
      'relativo al protocolo: parece interno y no lo es');
  });

  test('rechaza una lista vacía y una desmedida', () => {
    assert.ok(falla('tarjetas', doc([])));
    assert.ok(falla('tarjetas', doc(Array.from({ length: 13 }, () => TARJETA))));
  });
});
