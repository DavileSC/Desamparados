// Pruebas de la tienda (domain/tienda.ts), sin base: el total sale de los
// precios del catálogo, las líneas repetidas se juntan y no se vende lo que no hay.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { prepararPedido } from '../src/domain/tienda.js';
import { prepararVenta } from '../src/domain/caja.js';

const CATALOGO = [
  { id: 1, nombre: 'Medalla', centimos: 1500, activo: true, existencias: 3 },
  { id: 2, nombre: 'Estampa', centimos: 150, activo: true, existencias: null },
  { id: 3, nombre: 'Llavero', centimos: 500, activo: false, existencias: 10 },
];

describe('preparar un pedido', () => {
  test('calcula el total con los precios del catálogo y junta las líneas repetidas', () => {
    assert.deepEqual(prepararPedido([{ productoId: 1, cantidad: 1 }, { productoId: 2, cantidad: 4 }, { productoId: 1, cantidad: 1 }], CATALOGO), {
      lineas: [
        { productoId: 1, tallaId: null, talla: null, nombre: 'Medalla', centimos: 1500, cantidad: 2 },
        { productoId: 2, tallaId: null, talla: null, nombre: 'Estampa', centimos: 150, cantidad: 4 },
      ],
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

// La camiseta: lo que queda se cuenta en cada talla, no en el producto.
const CAMISETA = {
  id: 7, nombre: 'Camiseta', centimos: 1200, activo: true, existencias: null,
  tallas: [{ id: 70, nombre: 'S', existencias: 1 }, { id: 71, nombre: 'M', existencias: 5 }, { id: 72, nombre: 'XXL', existencias: 0 }],
};

describe('las tallas', () => {
  test('cada talla es su línea, y la misma talla dos veces se junta', () => {
    assert.deepEqual(prepararPedido([{ productoId: 7, tallaId: 71, cantidad: 2 }, { productoId: 7, tallaId: 70, cantidad: 1 }, { productoId: 7, tallaId: 71, cantidad: 1 }], [CAMISETA]), {
      lineas: [
        { productoId: 7, tallaId: 71, talla: 'M', nombre: 'Camiseta', centimos: 1200, cantidad: 3 },
        { productoId: 7, tallaId: 70, talla: 'S', nombre: 'Camiseta', centimos: 1200, cantidad: 1 },
      ],
      centimos: 4800,
    });
  });

  test('lo que queda es el de la talla, y la talla es obligatoria y suya', () => {
    assert.deepEqual(prepararPedido([{ productoId: 7, tallaId: 70, cantidad: 2 }], [CAMISETA]), { problema: 'De «Camiseta (talla S)» solo quedan 1.' });
    assert.deepEqual(prepararPedido([{ productoId: 7, tallaId: 72, cantidad: 1 }], [CAMISETA]), { problema: '«Camiseta (talla XXL)» se ha agotado.' });
    assert.deepEqual(prepararPedido([{ productoId: 7, cantidad: 1 }], [CAMISETA]), { problema: 'De «Camiseta» hay que elegir la talla.' });
    assert.match((prepararPedido([{ productoId: 7, tallaId: 99, cantidad: 1 }], [CAMISETA]) as { problema: string }).problema, /Esa talla de «Camiseta» ya no está/);
    assert.match((prepararPedido([{ productoId: 2, tallaId: 70, cantidad: 1 }], CATALOGO) as { problema: string }).problema, /ya no tiene tallas/);
  });

  test('en la caja, igual: por talla y con lo que queda de ella', () => {
    const v = prepararVenta([{ productoId: 7, tallaId: 71, cantidad: 2 }, { nombre: 'Libro usado', centimos: 500, cantidad: 1 }], [CAMISETA]);
    assert.ok(!('problema' in v));
    assert.deepEqual(v.lineas[0], { productoId: 7, tallaId: 71, talla: 'M', nombre: 'Camiseta', centimos: 1200, cantidad: 2 });
    assert.equal(v.centimos, 2900);
    assert.deepEqual(prepararVenta([{ productoId: 7, tallaId: 72, cantidad: 1 }], [CAMISETA]), { problema: '«Camiseta (talla XXL)» está agotado.' });
    assert.deepEqual(prepararVenta([{ productoId: 7, cantidad: 1 }], [CAMISETA]), { problema: 'De «Camiseta» hay que elegir la talla.' });
  });
});

