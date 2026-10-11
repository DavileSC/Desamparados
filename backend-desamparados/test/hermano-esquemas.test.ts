// Lo que el hermano manda al editar sus fichas desde el área no se fía de la
// web: la dirección, la población y el código postal se exigen igual que en
// el alta, los apellidos no admiten etiquetas y la tarjeta no es una forma de
// pago que pueda elegir (es de ventanilla). Antes eran «string» a secas, y
// `PUT {direccion: "", codigoPostal: "abc"}` o unos apellidos con `<img …>`
// daban 200. Secretaría, en cambio, guarda fichas del censo antiguo con la
// dirección vacía: su esquema la sigue admitiendo en blanco, pero sin `<>`.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import { addProfileSchema, updateAdminHermanoSchema, updateProfileSchema } from '../src/schemas/hermano.schema.js';
import { registerSchema } from '../src/schemas/auth.schema.js';

const valido = (esquema: (d: unknown) => unknown, body: unknown) => !(esquema({ body }) instanceof ArkErrors);

describe('editar la ficha desde el área de hermanos', () => {
  test('dirección, población y código postal no pueden ir vacíos ni con cualquier cosa', () => {
    assert.equal(valido(updateProfileSchema, { direccion: '' }), false);
    assert.equal(valido(updateProfileSchema, { direccion: '   ' }), false);
    assert.equal(valido(updateProfileSchema, { poblacion: '' }), false);
    assert.equal(valido(updateProfileSchema, { direccion: '<b>Calle</b>' }), false);
    assert.equal(valido(updateProfileSchema, { codigoPostal: 'abc' }), false);
    assert.equal(valido(updateProfileSchema, { codigoPostal: '' }), false);
    assert.equal(valido(updateProfileSchema, { direccion: 'Calle Lagunillas 34', poblacion: 'Málaga', codigoPostal: '29012' }), true);
  });

  test('el código postal llega recortado, como en el alta', () => {
    const r = updateProfileSchema({ body: { codigoPostal: ' 29012 ' } });
    assert.ok(!(r instanceof ArkErrors));
    assert.equal(r.body.codigoPostal, '29012');
  });

  test('los apellidos juntos no admiten etiquetas', () => {
    assert.equal(valido(updateProfileSchema, { apellidos: '<img src=x onerror=alert(1)>' }), false);
    assert.equal(valido(updateProfileSchema, { apellidos: 'Ruiz Montes' }), true);
    assert.equal(valido(addProfileSchema, { nombre: 'Ana', fechaNacimiento: '2018-01-01', apellidos: '<img src=x>' }), false);
    assert.equal(valido(addProfileSchema, { nombre: 'Ana', fechaNacimiento: '2018-01-01', apellidos: 'Ruiz Montes' }), true);
  });

  test('la tarjeta no es una forma de pago que elija el hermano', () => {
    assert.equal(valido(updateProfileSchema, { formaPagoPref: 'TARJETA' }), false);
    for (const forma of ['EFECTIVO', 'BIZUM', 'TRANSFERENCIA']) {
      assert.equal(valido(updateProfileSchema, { formaPagoPref: forma }), true, forma);
    }
  });
});

describe('editar la ficha desde el CMS', () => {
  test('la dirección puede quedar en blanco, pero sin etiquetas', () => {
    assert.equal(valido(updateAdminHermanoSchema, { direccion: '', poblacion: '', codigoPostal: '' }), true);
    assert.equal(valido(updateAdminHermanoSchema, { direccion: '<img src=x>' }), false);
    assert.equal(valido(updateAdminHermanoSchema, { apellidos: '<img src=x>' }), false);
  });
});

describe('el alta pública', () => {
  test('los apellidos de un menor no admiten etiquetas', () => {
    const conMenor = registerSchema({ body: { menores: [{ nombre: 'Ana', apellidos: '<img src=x>', fechaNacimiento: '2018-01-01' }] } });
    assert.ok(conMenor instanceof ArkErrors);
    assert.ok([...conMenor].some((e) => e.path.join('.') === 'body.menores.0.apellidos'), 'los apellidos del menor se rechazan');
  });
});
