// Pruebas de la máquina de estados de recibos. No tocan la base de datos, así
// que corren en cualquier máquina y en CI: es la parte del sistema donde un
// error cuesta dinero o deja descuadrada la contabilidad.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EstadoPago } from '@prisma/client';
import {
  puedeTransicionar,
  transicionesDesde,
  requiereReverso,
  ESTADOS_FINALES,
} from '../src/domain/recibo-estados.js';

const TODOS = Object.values(EstadoPago);

describe('máquina de estados de recibos', () => {
  test('un recibo pendiente puede remesarse, anularse o quedar exento', () => {
    assert.ok(puedeTransicionar(EstadoPago.PENDIENTE, EstadoPago.REMESADO));
    assert.ok(puedeTransicionar(EstadoPago.PENDIENTE, EstadoPago.ANULADO));
    assert.ok(puedeTransicionar(EstadoPago.PENDIENTE, EstadoPago.EXENTO));
  });

  test('cobrar no es una edición de estado', () => {
    // Marcar como pagado tiene su propia operación porque además genera el
    // asiento de ingreso: permitirlo aquí dejaría cobros sin apunte contable.
    for (const origen of TODOS) {
      assert.equal(
        puedeTransicionar(origen, EstadoPago.PAGADO),
        false,
        `${origen} -> PAGADO no debería permitirse desde la edición`
      );
    }
  });

  test('un cobro solo puede retrocederse a devuelto', () => {
    assert.deepEqual(transicionesDesde(EstadoPago.PAGADO), [EstadoPago.DEVUELTO]);
  });

  test('un recibo remesado puede acabar devuelto o anulado, pero no exento', () => {
    assert.ok(puedeTransicionar(EstadoPago.REMESADO, EstadoPago.DEVUELTO));
    assert.ok(puedeTransicionar(EstadoPago.REMESADO, EstadoPago.ANULADO));
    assert.equal(puedeTransicionar(EstadoPago.REMESADO, EstadoPago.EXENTO), false);
  });

  test('los estados finales no admiten ninguna salida', () => {
    for (const final of ESTADOS_FINALES) {
      assert.deepEqual(transicionesDesde(final), [], `${final} debería ser final`);
      for (const destino of TODOS) {
        assert.equal(
          puedeTransicionar(final, destino),
          false,
          `${final} -> ${destino} reabriría un recibo cerrado`
        );
      }
    }
  });

  test('ningún estado puede transicionar a sí mismo', () => {
    for (const estado of TODOS) {
      assert.equal(puedeTransicionar(estado, estado), false);
    }
  });

  test('no se puede volver atrás a pendiente', () => {
    // Reabrir un recibo cerrado como si nunca hubiera pasado nada borraría el
    // rastro del intento de cobro.
    for (const origen of TODOS) {
      assert.equal(
        puedeTransicionar(origen, EstadoPago.PENDIENTE),
        false,
        `${origen} -> PENDIENTE borraría el histórico`
      );
    }
  });

  test('todos los estados están contemplados en el grafo', () => {
    // Si alguien añade un estado al enum de Prisma y olvida el grafo,
    // transicionesDesde devolvería undefined y el recibo quedaría bloqueado.
    for (const estado of TODOS) {
      assert.ok(Array.isArray(transicionesDesde(estado)), `falta ${estado} en el grafo`);
    }
  });

  test('solo la devolución de un cobro genera asiento de reverso', () => {
    assert.ok(requiereReverso(EstadoPago.PAGADO, EstadoPago.DEVUELTO));

    // Un remesado devuelto nunca llegó a ingresar: un reverso inventaría un gasto.
    assert.equal(requiereReverso(EstadoPago.REMESADO, EstadoPago.DEVUELTO), false);
    assert.equal(requiereReverso(EstadoPago.PENDIENTE, EstadoPago.ANULADO), false);
    assert.equal(requiereReverso(EstadoPago.PENDIENTE, EstadoPago.EXENTO), false);
  });

  test('toda transición válida parte de un estado no final', () => {
    for (const origen of TODOS) {
      if (transicionesDesde(origen).length > 0) {
        assert.equal(
          ESTADOS_FINALES.includes(origen),
          false,
          `${origen} tiene salidas pero está marcado como final`
        );
      }
    }
  });
});
