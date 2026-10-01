// Las etiquetas postales (octubre de 2026): una por casa y dónde cae cada una.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FORMATOS_DE_ETIQUETAS, lineasDeDireccion, posicionDe, sobresDe, type DestinatarioPostal } from '../src/domain/etiquetas.js';

const casa = { direccion: 'C. Larios, 1, 2.º A', codigoPostal: '29005', poblacion: 'Málaga', provincia: 'Málaga' };
const hermano = (nombre: string, extra: Partial<DestinatarioPostal> = {}): DestinatarioPostal => ({
  nombre, apellidos: 'Ruiz Gil', sexo: 'HOMBRE', tratamiento: null, numeroHermano: null, esTitular: false, ...casa, ...extra,
});

describe('las etiquetas postales', () => {
  test('por domicilio, la misma casa aunque esté escrita distinto va a la familia del titular', () => {
    const sobres = sobresDe([
      hermano('Ana', { sexo: 'MUJER' }),
      hermano('Luis', { esTitular: true, apellidos: 'Ruiz Pérez', direccion: 'c/ larios 1 2º a' }),
      hermano('Eva', { sexo: 'MUJER', direccion: 'Calle Granada, 3' }),
      hermano('Sin casa', { direccion: null }),
    ], true);
    assert.deepEqual(sobres.map((s) => s.aQuien), ['Familia Ruiz Pérez', 'Dña. Eva Ruiz Gil']);
    assert.equal(sobres[0].direccion, 'c/ larios 1 2º a', 'la dirección del titular, tal como está en su ficha');
  });

  test('una por hermano, sin los que no tienen dirección', () => {
    assert.deepEqual(sobresDe([hermano('Ana'), hermano('Luis'), hermano('Sin casa', { direccion: ' ' })], false).map((s) => s.aQuien), ['D. Ana Ruiz Gil', 'D. Luis Ruiz Gil']);
  });

  test('la provincia solo si no es la misma población', () => {
    assert.deepEqual(lineasDeDireccion({ ...casa, aQuien: 'D. Luis' }), ['D. Luis', 'C. Larios, 1, 2.º A', '29005 Málaga']);
    assert.deepEqual(lineasDeDireccion({ ...casa, poblacion: 'Alhaurín de la Torre', aQuien: 'D. Luis' }).at(-1), '29005 Alhaurín de la Torre (Málaga)');
  });

  test('se rellena por filas y la que sigue a la última de la hoja empieza otra', () => {
    const f = FORMATOS_DE_ETIQUETAS['3x7'];
    assert.deepEqual(posicionDe(f, 0), { hoja: 0, x: 7.2, y: 15.15 });
    assert.deepEqual(posicionDe(f, 4), { hoja: 0, x: 7.2 + 66, y: 15.15 + 38.1 });
    assert.equal(posicionDe(f, 21).hoja, 1);
  });

  test('todas las hojas caben en un A4', () => {
    for (const [clave, f] of Object.entries(FORMATOS_DE_ETIQUETAS)) {
      assert.ok(f.izquierda + (f.columnas - 1) * f.pasoX + f.ancho <= 210, `${clave} de ancho`);
      assert.ok(f.arriba + (f.filas - 1) * f.pasoY + f.alto <= 297, `${clave} de alto`);
    }
  });
});
