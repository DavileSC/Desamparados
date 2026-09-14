import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ArkErrors } from 'arktype';
import { dni, telefono, textoRequerido, codigoPostal } from '../src/config/common.js';

// La misma tabla que lee desamparados-web/src/lib/validacion/__tests__/identidad.test.ts.
// Son dos paquetes sin código compartido: esta tabla es lo único que impide
// que el formulario vuelva a admitir lo que el servidor rechaza.
const casos = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../shared/casos-identidad.json', import.meta.url)), 'utf8')
) as {
  dni: { valor: string; valido: boolean; normalizado: string }[];
  telefono: { valor: string; valido: boolean; normalizado: string }[];
  codigoPostal: { valor: string; valido: boolean; normalizado: string }[];
  texto: { valor: string; valido: boolean }[];
};

// ArkType devuelve los datos si valen y una instancia de ArkErrors si no. El
// mismo idioma que usan src/config/validate.ts y test/mensajes-validacion.test.ts.
const acepta = (validador: { (valor: unknown): unknown }, valor: string) =>
  !(validador(valor) instanceof ArkErrors);

// Antes el validador comprobaba sobre el valor en mayúsculas pero devolvía
// el que le habían mandado; ahora que normaliza de verdad, esta tabla puede
// alimentarse con el valor crudo (como hace el código postal más abajo) y
// comprobar además que lo que devuelve es el normalizado.
test('el DNI: el servidor acepta y normaliza lo mismo que el formulario', () => {
  for (const caso of casos.dni) {
    const resultado = dni(caso.valor);
    const fueAceptado = !(resultado instanceof ArkErrors);
    assert.equal(fueAceptado, caso.valido, `DNI ${JSON.stringify(caso.valor)}`);
    if (fueAceptado) {
      assert.equal(resultado, caso.normalizado, `DNI normalizado ${JSON.stringify(caso.valor)}`);
    }
  }
});

test('el servidor devuelve el DNI normalizado, no el que le mandaron', () => {
  // El formulario ya normaliza, pero el servidor no puede fiarse del cliente:
  // con la minúscula guardada, el @unique de Prisma deja de proteger.
  for (const crudo of ['12345678z', '12345678-Z', '12345678 z', 'x1234567l']) {
    const resultado = dni(crudo);
    assert.equal(typeof resultado, 'string', `${crudo} debería valer`);
    assert.equal(resultado, String(resultado).replace(/[\s-]/g, '').toUpperCase());
    assert.match(String(resultado), /^[XYZ0-9][0-9]{7}[A-Z]$/);
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

// El formulario no normaliza el código postal antes de enviarlo (a diferencia
// del DNI y el teléfono): lo que llega al servidor es `caso.valor` tal cual,
// espacios incluidos. Por eso este test alimenta el valor crudo y comprueba,
// además de la aceptación, que el servidor devuelve el recortado.
test('el código postal: el servidor acepta y recorta lo mismo que el formulario', () => {
  for (const caso of casos.codigoPostal) {
    const resultado = codigoPostal(caso.valor);
    const fueAceptado = !(resultado instanceof ArkErrors);
    assert.equal(fueAceptado, caso.valido, `código postal ${JSON.stringify(caso.valor)}`);
    if (fueAceptado) {
      assert.equal(resultado, caso.normalizado, `código postal recortado ${JSON.stringify(caso.valor)}`);
    }
  }
});
