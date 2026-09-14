import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dni, telefono, textoRequerido } from '../src/config/common.js';

// La misma tabla que lee desamparados-web/src/lib/validacion/__tests__/identidad.test.ts.
// Son dos paquetes sin código compartido: esta tabla es lo único que impide
// que el formulario vuelva a admitir lo que el servidor rechaza.
const casos = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../shared/casos-identidad.json', import.meta.url)), 'utf8')
) as {
  dni: { valor: string; valido: boolean; normalizado: string }[];
  telefono: { valor: string; valido: boolean; normalizado: string }[];
  codigoPostal: { valor: string; valido: boolean }[];
  texto: { valor: string; valido: boolean }[];
};

/** ArkType devuelve los datos si valen y un ArkErrors si no. */
const acepta = (validador: { (valor: unknown): unknown }, valor: string) =>
  !(String((validador(valor) as { constructor?: { name?: string } })?.constructor?.name) === 'ArkErrors');

test('el DNI: el servidor acepta lo mismo que el formulario, ya normalizado', () => {
  for (const caso of casos.dni) {
    assert.equal(acepta(dni, caso.normalizado), caso.valido, `DNI ${JSON.stringify(caso.valor)}`);
  }
});

test('el teléfono: el servidor acepta lo mismo que el formulario, ya normalizado', () => {
  for (const caso of casos.telefono) {
    assert.equal(acepta(telefono, caso.normalizado), caso.valido, `teléfono ${JSON.stringify(caso.valor)}`);
  }
});

test('el texto libre: el servidor rechaza lo mismo que el formulario', () => {
  for (const caso of casos.texto) {
    assert.equal(acepta(textoRequerido, caso.valor), caso.valido, `texto ${JSON.stringify(caso.valor)}`);
  }
});
