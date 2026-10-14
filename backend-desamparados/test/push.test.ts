// Qué direcciones se aceptan como servicio de push: el servidor les hace un POST.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esEndpointDePush } from '../src/domain/push.js';

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
