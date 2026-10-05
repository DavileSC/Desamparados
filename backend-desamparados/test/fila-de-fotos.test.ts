import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Fila } from '../src/utils/fila-de-fotos.js';

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('la fila hace los trabajos de uno en uno y en el orden de llegada', async () => {
  const fila = new Fila();
  let dentro = 0;
  let maximo = 0;
  const orden: number[] = [];
  await Promise.all([30, 5, 15, 1].map((ms, i) => fila.hacer(async () => {
    dentro++;
    maximo = Math.max(maximo, dentro);
    await dormir(ms);
    orden.push(i);
    dentro--;
    return i;
  })));
  assert.equal(maximo, 1);
  assert.deepEqual(orden, [0, 1, 2, 3]);
});

test('una foto que falla no deja la fila atascada', async () => {
  const fila = new Fila();
  const mala = fila.hacer(async () => { throw new Error('foto rota'); });
  const buena = fila.hacer(async () => 'ok');
  await assert.rejects(mala, /foto rota/);
  assert.equal(await buena, 'ok');
  // Y la fila queda libre para la siguiente.
  assert.equal(await fila.hacer(async () => 'después'), 'después');
});
