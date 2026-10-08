// Pruebas de la hoja del censo (domain/censo-hoja.ts), sin base de datos:
// qué títulos de columna se reconocen, cómo se leen las fechas y cada fila, las
// repeticiones dentro del fichero y el CSV de ida y vuelta.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  COLUMNAS_EXPORTACION, detectarColumnas, escribirCsv, leerCsv, leerFecha, leerFila, quitarRepetidas, tituloDe,
  type FichaImportada,
} from '../src/domain/censo-hoja.js';

const HOY = '2026-09-30';

describe('columnas', () => {
  test('reconoce los títulos de siempre, con o sin tildes, puntos y mayúsculas', () => {
    assert.deepEqual(
      detectarColumnas(['Nº', 'NOMBRE', 'Apellido 1', 'Apellido 2', 'N.I.F.', 'F. Nacimiento', 'Localidad', 'C.P.', 'F. Alta', 'E-mail', 'Móvil', 'Observaciones']),
      ['numeroHermano', 'nombre', 'primerApellido', 'segundoApellido', 'dni', 'fechaNacimiento', 'poblacion', 'codigoPostal', 'fechaAlta', 'email', 'telefono', null],
    );
  });

  test('lo que se exporta se vuelve a reconocer tal cual', () => {
    assert.deepEqual(detectarColumnas(COLUMNAS_EXPORTACION.map(tituloDe)), COLUMNAS_EXPORTACION);
  });

  test('una columna repetida vale la primera vez', () => {
    assert.deepEqual(detectarColumnas(['Teléfono', 'Tlf']), ['telefono', null]);
  });
});

describe('fechas', () => {
  test('entiende la fecha de Excel y las formas habituales en texto', () => {
    assert.equal(leerFecha(new Date('1990-03-15T00:00:00Z'), HOY), '1990-03-15');
    assert.equal(leerFecha('15/03/1990', HOY), '1990-03-15');
    assert.equal(leerFecha('5-3-1990', HOY), '1990-03-05');
    assert.equal(leerFecha('1990-03-15', HOY), '1990-03-15');
    assert.equal(leerFecha('15.03.1990', HOY), '1990-03-15');
  });

  test('con dos cifras, los años que pasan del actual son del siglo pasado', () => {
    assert.equal(leerFecha('15/03/90', HOY), '1990-03-15');
    assert.equal(leerFecha('15/03/12', HOY), '2012-03-15');
  });

  test('lo que no es una fecha, o no existe, no se inventa', () => {
    assert.equal(leerFecha('31/02/1990', HOY), null);
    assert.equal(leerFecha('marzo del 90', HOY), null);
    assert.equal(leerFecha('', HOY), null);
  });
});

describe('una fila', () => {
  const columnas = detectarColumnas(['Número', 'Nombre', 'Apellidos', 'DNI', 'Fecha de nacimiento', 'Sexo', 'Correo', 'Fecha de alta', 'Fecha de baja', 'IBAN', 'Estado']);
  const fila = (valores: unknown[]) => leerFila(valores, columnas, 2, HOY);

  test('la fila buena sale con sus datos limpios', () => {
    const r = fila(['12', 'Ana María', 'García de la Vega', '1234567-l', '15/03/1990', 'Mujer', 'Ana@Ejemplo.ES', '01/01/2010', '', 'es91 2100 0418 4502 0005 1332', 'Activo']);
    assert.ok('ficha' in r);
    assert.deepEqual(r.ficha, {
      fila: 2, nombre: 'Ana María', primerApellido: 'García de la Vega', segundoApellido: null, dni: '01234567L',
      fechaNacimiento: '1990-03-15', sexo: 'MUJER', telefono: null, email: 'ana@ejemplo.es', direccion: null, poblacion: null,
      codigoPostal: null, provincia: null, fechaAlta: '2010-01-01', fechaBaja: null, iban: 'ES9121000418450200051332', numeroHermano: 12,
    });
  });

  test('dos apellidos juntos se parten; sin fecha de alta, la de hoy', () => {
    const r = fila(['', 'Luis', 'Pérez Gil', '', '1980-01-01', '', '', '', '', '', '']);
    assert.ok('ficha' in r);
    assert.deepEqual([r.ficha.primerApellido, r.ficha.segundoApellido, r.ficha.fechaAlta, r.ficha.numeroHermano], ['Pérez', 'Gil', HOY, null]);
  });

  test('junta todos los errores de la fila de una vez', () => {
    const r = fila(['doce', '', '', '12345678A', '', 'X', 'sin-arroba', '01/01/2030', '', 'ES00', '']);
    assert.ok('errores' in r);
    assert.deepEqual(r.errores, [
      'Falta el nombre.',
      'Faltan los apellidos.',
      'Falta la fecha de nacimiento.',
      'El DNI «12345678A» no es válido (revisa la letra).',
      'El correo «sin-arroba» no es válido.',
      'El sexo «X» no se entiende (Hombre o Mujer).',
      'La fecha de alta es posterior a hoy.',
      'La cuenta no es un IBAN válido (revisa los dígitos de control).',
      'El número «doce» no es un número de hermano.',
    ]);
  });

  test('de baja, con su fecha; sin ella, error', () => {
    const baja = fila(['', 'Eva', 'Ruiz', '', '1970-01-01', '', '', '2000-01-01', '2020-05-01', '', 'De baja']);
    assert.ok('ficha' in baja && baja.ficha.fechaBaja === '2020-05-01');
    const sinFecha = fila(['', 'Eva', 'Ruiz', '', '1970-01-01', '', '', '2000-01-01', '', '', 'Baja']);
    assert.ok('errores' in sinFecha && sinFecha.errores[0].includes('falta la fecha de baja'));
    const alReves = fila(['', 'Eva', 'Ruiz', '', '1970-01-01', '', '', '2020-01-01', '2000-01-01', '', '']);
    assert.ok('errores' in alReves && alReves.errores[0].includes('anterior a la de alta'));
  });
});

describe('repeticiones dentro del fichero', () => {
  const ficha = (fila: number, cambios: Partial<FichaImportada>): FichaImportada => ({
    fila, nombre: 'Ana', primerApellido: 'Gil', segundoApellido: null, dni: null, fechaNacimiento: '1990-01-01', sexo: null,
    telefono: null, email: null, direccion: null, poblacion: null, codigoPostal: null, provincia: null,
    fechaAlta: '2010-01-01', fechaBaja: null, iban: null, numeroHermano: null, ...cambios,
  });

  test('el mismo DNI, el mismo número o la misma persona sin DNI: se queda la primera', () => {
    const { fichas, errores } = quitarRepetidas([
      ficha(2, { dni: '01234567L', numeroHermano: 1 }),
      ficha(3, { dni: '01234567L', nombre: 'Otra' }),
      ficha(4, { nombre: 'Luis', numeroHermano: 1 }),
      ficha(5, { nombre: 'Pepe' }),
      ficha(6, { nombre: 'PEPE' }),
    ]);
    assert.deepEqual(fichas.map((f) => f.fila), [2, 5]);
    assert.deepEqual(errores, [
      { fila: 3, errores: ['El DNI 01234567L ya está en la fila 2.'] },
      { fila: 4, errores: ['El número 1 ya está en la fila 2.'] },
      { fila: 6, errores: ['Parece la misma persona de la fila 5.'] },
    ]);
  });
});

describe('CSV', () => {
  test('lee con punto y coma o con coma, con comillas y saltos de línea dentro', () => {
    assert.deepEqual(leerCsv('\uFEFFNombre;Dirección\r\nAna;"C/ Mayor; 3"\r\n\r\n'), [['Nombre', 'Dirección'], ['Ana', 'C/ Mayor; 3']]);
    assert.deepEqual(leerCsv('Nombre,Nota\nAna,"dice ""hola""\ny adiós"'), [['Nombre', 'Nota'], ['Ana', 'dice "hola"\ny adiós']]);
  });

  // Un texto del alta que empieza por «=», «+», «-», «@», tabulador o retorno
  // se abría como fórmula en Excel al abrir el censo exportado.
  test('un texto que parece una fórmula sale con «\'» delante y vuelve a leerse igual', () => {
    const peligrosos = ['=HYPERLINK("http://x")', '+34 600 000 000', '-2+3', '@SUMA(A1)', '\tTab', '\rRetorno'];
    const csv = escribirCsv([peligrosos]);
    const celdas = csv.replace(/^﻿/, '').trimEnd().split(';');
    for (const c of celdas) assert.match(c, /^"?'/, `sin neutralizar: ${JSON.stringify(c)}`);
    assert.deepEqual(leerCsv(csv), [peligrosos]);
    // Un número de verdad no es una fórmula y no se toca.
    assert.equal(escribirCsv([[-5, 12]]), '﻿-5;12\r\n');
  });

  test('lo que escribe lo vuelve a leer igual', () => {
    const filas = [['Nombre', 'Dirección', 'Número'], ['Ana', 'C/ Mayor; 3', '12'], ['Luis "el Moreno"', '', '']];
    assert.deepEqual(leerCsv(escribirCsv(filas)), filas);
    assert.ok(escribirCsv(filas).startsWith('\uFEFF'));
  });
});
