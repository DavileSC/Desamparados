// Pruebas de la tienda (domain/tienda.ts), sin base: el total sale de los
// precios del catálogo, las líneas repetidas se juntan y no se vende lo que no hay.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { prepararPedido } from '../src/domain/tienda.js';

const CATALOGO = [
  { id: 1, nombre: 'Medalla', centimos: 1500, activo: true, existencias: 3 },
  { id: 2, nombre: 'Estampa', centimos: 150, activo: true, existencias: null },
  { id: 3, nombre: 'Llavero', centimos: 500, activo: false, existencias: 10 },
];

describe('preparar un pedido', () => {
  test('calcula el total con los precios del catálogo y junta las líneas repetidas', () => {
    assert.deepEqual(prepararPedido([{ productoId: 1, cantidad: 1 }, { productoId: 2, cantidad: 4 }, { productoId: 1, cantidad: 1 }], CATALOGO), {
      lineas: [{ productoId: 1, nombre: 'Medalla', centimos: 1500, cantidad: 2 }, { productoId: 2, nombre: 'Estampa', centimos: 150, cantidad: 4 }],
      centimos: 3600,
    });
  });

  test('no vende lo que no hay, lo retirado ni cantidades raras', () => {
    assert.deepEqual(prepararPedido([{ productoId: 1, cantidad: 4 }], CATALOGO), { problema: 'De «Medalla» solo quedan 3.' });
    assert.deepEqual(prepararPedido([{ productoId: 1, cantidad: 1 }], [{ ...CATALOGO[0], existencias: 0 }]), { problema: '«Medalla» se ha agotado.' });
    assert.match((prepararPedido([{ productoId: 3, cantidad: 1 }], CATALOGO) as { problema: string }).problema, /ya no está a la venta/);
    assert.match((prepararPedido([{ productoId: 99, cantidad: 1 }], CATALOGO) as { problema: string }).problema, /ya no está a la venta/);
    assert.match((prepararPedido([{ productoId: 2, cantidad: 21 }], CATALOGO) as { problema: string }).problema, /entre 1 y 20/);
    assert.match((prepararPedido([{ productoId: 2, cantidad: 0 }], CATALOGO) as { problema: string }).problema, /entre 1 y 20/);
    assert.deepEqual(prepararPedido([], CATALOGO), { problema: 'La cesta está vacía.' });
  });
});
