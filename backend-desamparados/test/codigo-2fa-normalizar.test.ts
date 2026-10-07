// El código del segundo factor tal como lo teclea la gente. En el móvil el
// teclado escribe en minúsculas y hay apps que enseñan el TOTP partido
// («863 427»): rechazar eso dejaba fuera a quien había perdido el móvil justo
// con el código de respaldo bueno en la mano.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizarCodigo2FA } from '../src/services/auth/codigos-2fa.js';
import { verify2FASchema } from '../src/schemas/auth.schema.js';

const vale = (token2fa: string) =>
  !(verify2FASchema({ body: { token2fa }, query: {}, params: {} }) as { summary?: string }).summary;

test('el código de respaldo vale en minúsculas, sin guiones o con espacios', () => {
  for (const tecleado of ['a4zg-un8z-6ttx', 'A4ZG-UN8Z-6TTX', 'a4zgun8z6ttx', ' a4zg un8z 6ttx ']) {
    assert.ok(vale(tecleado), `el esquema debe admitir «${tecleado}»`);
    assert.equal(normalizarCodigo2FA(tecleado), 'A4ZG-UN8Z-6TTX');
  }
});

test('el TOTP vale también partido en dos', () => {
  for (const tecleado of ['863427', '863 427', ' 863427 ']) {
    assert.ok(vale(tecleado), `el esquema debe admitir «${tecleado}»`);
    assert.equal(normalizarCodigo2FA(tecleado), '863427');
  }
});

test('lo que no es ni lo uno ni lo otro se sigue rechazando', () => {
  for (const malo of ['12345', '1234567', 'A4ZG-UN8Z', 'A4ZG-UN8Z-6TTX-XXXX', 'hola', '']) {
    assert.ok(!vale(malo), `el esquema no debe admitir «${malo}»`);
  }
});
