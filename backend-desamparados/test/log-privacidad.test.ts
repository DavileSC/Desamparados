import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { enmascararEmail } from '../src/utils/log-privacidad.js';

describe('enmascararEmail', () => {
  test('deja reconocible al destinatario sin publicar su dirección', () => {
    assert.equal(enmascararEmail('hermano@ejemplo.org'), 'he•••@ejemplo.org');
    assert.equal(enmascararEmail('secretaria@desamparadosmalaga.com'), 'se•••@desamparadosmalaga.com');
  });

  test('nunca deja pasar la parte local entera', () => {
    for (const email of ['a@b.org', 'ab@b.org', 'abc@b.org', 'nombre.apellido@correo.es']) {
      const local = email.slice(0, email.lastIndexOf('@'));
      const enmascarado = enmascararEmail(email);
      if (local.length > 2) {
        assert.ok(!enmascarado.includes(local), `"${enmascarado}" conserva la parte local completa`);
      }
    }
  });

  test('aguanta entradas malformadas sin lanzar', () => {
    assert.equal(enmascararEmail(''), '•••');
    assert.equal(enmascararEmail('sin-arroba'), '•••');
    assert.equal(enmascararEmail('@solo-dominio.org'), '•••');
  });
});
