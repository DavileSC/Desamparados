// Qué le falta a una ficha para confirmarla en el primer acceso: lo del alta
// para el titular, y nombre, nacimiento y parentesco para quien cuelga de él.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enUnaFrase, faltanEnLaFicha, type FichaQueSeRevisa } from '../src/domain/ficha-obligatoria.js';

const completa: FichaQueSeRevisa = {
  esTitular: true, nombre: 'Antonio', apellidos: 'Ruiz Montes', primerApellido: 'Ruiz', dni: '12345678Z',
  fechaNacimiento: new Date(Date.UTC(1980, 0, 1)), sexo: 'HOMBRE', estadoCivil: 'CASADO', fechaBautismo: new Date(Date.UTC(1980, 2, 1)),
  email: 'antonio@ejemplo.test', telefono: '600000000', direccion: 'Calle Lagunillas 34', codigoPostal: '29012', poblacion: 'Málaga',
  parentesco: null, formaPagoPref: 'EFECTIVO', iban: null, titularidadCuenta: null, titularCuenta: null,
};
const campos = (f: FichaQueSeRevisa, conCuotas = true) => faltanEnLaFicha(f, conCuotas).map((c) => c.campo);

test('una ficha completa no echa nada en falta; un texto en blanco cuenta como vacío', () => {
  assert.deepEqual(campos(completa), []);
  assert.deepEqual(campos({ ...completa, telefono: '  ', poblacion: null }), ['telefono', 'poblacion']);
});

test('las fichas antiguas valen con los apellidos juntos', () => {
  assert.deepEqual(campos({ ...completa, primerApellido: null }), []);
});

test('la domiciliación pide IBAN y de quién es la cuenta, y el nombre si no es propia; solo con cuotas en línea', () => {
  const domiciliada = { ...completa, formaPagoPref: 'DOMICILIACION' };
  assert.deepEqual(campos(domiciliada), ['iban', 'titularidadCuenta']);
  assert.deepEqual(campos({ ...domiciliada, iban: 'ES00', titularidadCuenta: 'OTRA_PERSONA' }), ['titularCuenta']);
  assert.deepEqual(campos({ ...domiciliada, iban: 'ES00', titularidadCuenta: 'PROPIA' }), []);
  assert.deepEqual(campos(domiciliada, false), []);
});

test('a quien cuelga de la cuenta no se le piden DNI ni contacto, pero sí el parentesco', () => {
  const hija: FichaQueSeRevisa = { ...completa, esTitular: false, dni: null, telefono: null, estadoCivil: null, fechaBautismo: null, formaPagoPref: 'DOMICILIACION' };
  assert.deepEqual(campos(hija), ['parentesco']);
  assert.deepEqual(campos({ ...hija, parentesco: 'HIJO' }), []);
});

test('la frase junta los campos y deja «DNI» en mayúsculas', () => {
  assert.equal(enUnaFrase(faltanEnLaFicha({ ...completa, dni: null, telefono: null, sexo: null }, true)), 'DNI o NIE, sexo y teléfono móvil');
});
