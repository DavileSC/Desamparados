// Lo que se decide sin base: el número que cuadrar, el texto del aviso y qué
// direcciones se aceptan como servicio de push.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describirNavegador, esEndpointDePush, numeroYOpciones } from '../src/domain/aprobacion-entrada.js';

test('el número está entre las tres opciones, que son distintas y de dos cifras', () => {
  for (let i = 0; i < 200; i++) {
    const { numero, opciones } = numeroYOpciones((n) => Math.floor(Math.random() * n));
    assert.equal(opciones.length, 3);
    assert.equal(new Set(opciones).size, 3);
    assert.ok(opciones.includes(numero));
    for (const o of opciones) assert.ok(o >= 10 && o <= 99, `${o} no es de dos cifras`);
  }
});

test('el bueno no va siempre en el mismo sitio', () => {
  const sitios = new Set<number>();
  for (let i = 0; i < 100; i++) {
    const { numero, opciones } = numeroYOpciones((n) => Math.floor(Math.random() * n));
    sitios.add(opciones.indexOf(numero));
  }
  assert.equal(sitios.size, 3);
});

test('el aviso dice el sistema y el navegador, y nada más', () => {
  const casos: [string, string][] = [
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', 'Windows · Chrome'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0', 'Windows · Edge'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Mac · Safari'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'iPhone · Safari'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36', 'Android · Chrome'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Linux · Firefox'],
  ];
  for (const [ua, esperado] of casos) assert.equal(describirNavegador(ua), esperado);
  assert.equal(describirNavegador(undefined), 'un navegador desconocido');
});

test('solo se aceptan servicios de push conocidos, por https y sin puerto', () => {
  for (const bueno of [
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMHDqjoZsYbqQ',
    'https://wns2-db5p.notify.windows.com/w/?token=abc',
  ]) assert.ok(esEndpointDePush(bueno), bueno);
  for (const malo of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/fcm/send/abc',
    'https://127.0.0.1/fcm/send',
    'https://fcm.googleapis.com.ejemplo.test/x',
    'https://usuario:clave@fcm.googleapis.com/x',
    'https://localhost:3001/api/auth/logout',
    'no es una url',
  ]) assert.ok(!esEndpointDePush(malo), malo);
});
