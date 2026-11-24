// Los rebotes que llegan al buzón, las cabeceras de la baja en un clic y el
// filtro del censo: todo puro, sin base de datos.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leerRebote } from '../src/domain/avisos-de-envio.js';
import { cabecerasDeBaja, emailDeToken } from '../src/domain/comunicados.js';
import { filtrosAvanzados } from '../src/domain/filtros-censo.js';
import { informeDeRebote } from './fixtures/rebotes.js';

test('un informe de rebote da la dirección, el motivo por el código y lo que contestó el servidor', () => {
  assert.deepEqual(leerRebote(informeDeRebote([{ email: 'Ana@Ejemplo.TEST', estado: '5.1.1', diagnostico: 'smtp; 550 5.1.1 <ana@ejemplo.test>: User unknown' }])), [
    { email: 'ana@ejemplo.test', motivo: 'INVALIDO', bajaDelBoletin: false, detalle: '550 5.1.1 <ana@ejemplo.test>: User unknown' },
  ]);
  const motivo = (estado: string) => leerRebote(informeDeRebote([{ email: 'x@ejemplo.test', estado }]))[0]?.motivo;
  assert.equal(motivo('5.1.2'), 'INVALIDO');
  assert.equal(motivo('5.7.1'), 'BLOQUEADO');
  assert.equal(motivo('5.2.2'), 'REBOTE');
  // Sin diagnóstico, el código.
  assert.equal(leerRebote(informeDeRebote([{ email: 'x@ejemplo.test', estado: '5.2.2' }]))[0]?.detalle, '5.2.2');
});

test('solo cuenta lo que falló del todo: un retraso o un 4.x no marcan a nadie', () => {
  const avisos = leerRebote(informeDeRebote([
    { email: 'falla@ejemplo.test', estado: '5.1.1' },
    { email: 'espera@ejemplo.test', estado: '4.4.1', accion: 'delayed' },
    { email: 'temporal@ejemplo.test', estado: '4.2.2', accion: 'failed' },
    { email: 'llego@ejemplo.test', estado: '2.0.0', accion: 'delivered' },
  ]));
  assert.deepEqual(avisos.map((a) => a.email), ['falla@ejemplo.test']);
});

test('un correo que no es un informe de entrega no da nada, aunque hable de rebotes', () => {
  const normal = [
    'From: Ana <ana@ejemplo.test>', 'Subject: Undelivered Mail', 'Content-Type: text/plain', '',
    'Action: failed', 'Final-Recipient: rfc822; luis@ejemplo.test', 'Status: 5.1.1', '',
  ].join('\r\n');
  assert.deepEqual(leerRebote(normal), []);
  const vacaciones = [
    'From: Luis <luis@ejemplo.test>', 'Auto-Submitted: auto-replied', 'Subject: Fuera de la oficina', '', 'Vuelvo el lunes.', '',
  ].join('\r\n');
  assert.deepEqual(leerRebote(vacaciones), []);
  assert.deepEqual(leerRebote(''), []);
});

test('las líneas partidas del informe se unen, y una dirección mal formada se descarta', () => {
  const partida = informeDeRebote([{ email: 'eva@ejemplo.test', estado: '5.1.1', diagnostico: 'smtp; 550 5.1.1 The email account that you tried\r\n    to reach does not exist' }]);
  assert.equal(leerRebote(partida)[0]?.detalle, '550 5.1.1 The email account that you tried to reach does not exist');
  assert.deepEqual(leerRebote(informeDeRebote([{ email: 'sin-arroba', estado: '5.1.1' }])), []);
});

test('la baja en un clic apunta a la API con el enlace firmado de esa dirección', () => {
  const secreto = 'secreto-de-prueba';
  const cabeceras = cabecerasDeBaja('Ana@Ejemplo.test', secreto, 'https://desamparados.test/');
  assert.equal(cabeceras['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  const url = /^<(.+)>$/.exec(cabeceras['List-Unsubscribe'])?.[1];
  assert.ok(url?.startsWith('https://desamparados.test/api/boletin/baja-directa?t='), url);
  assert.equal(emailDeToken(new URL(url!).searchParams.get('t')!, secreto), 'ana@ejemplo.test');
});

test('el filtro «correo que rebota» busca la dirección de la ficha o, sin ella, la de su cuenta', () => {
  const [condicion] = filtrosAvanzados({ correo: 'rebota' }, new Date(), ['ana@ejemplo.test']);
  assert.deepEqual(condicion, {
    OR: [
      { email: { in: ['ana@ejemplo.test'] } },
      { AND: [{ OR: [{ email: null }, { email: '' }] }, { user: { email: { in: ['ana@ejemplo.test'] } } }] },
    ],
  });
});
