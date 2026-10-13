// Pruebas de la máquina de estados de recibos. No tocan la base de datos, así
// que corren en cualquier máquina y en CI: es la parte del sistema donde un
// error cuesta dinero o deja descuadrada la contabilidad.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EstadoPago, MetodoPago } from '@prisma/client';
import {
  puedeTransicionar,
  transicionesDesde,
  requiereReverso,
  ESTADOS_FINALES,
  puedeCobrarse,
  estadosCobrablesCon,
  anulaPapeleta,
} from '../src/domain/recibo-estados.js';

const TODOS = Object.values(EstadoPago);

describe('máquina de estados de recibos', () => {
  test('un recibo pendiente puede anularse o quedar exento', () => {
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

  test('un cobro solo puede retrocederse a devuelto o a reembolsado', () => {
    assert.deepEqual(transicionesDesde(EstadoPago.PAGADO), [EstadoPago.DEVUELTO, EstadoPago.REEMBOLSADO]);
    assert.ok(requiereReverso(EstadoPago.PAGADO, EstadoPago.REEMBOLSADO));
    assert.ok(anulaPapeleta(EstadoPago.REEMBOLSADO));
    assert.deepEqual(transicionesDesde(EstadoPago.REEMBOLSADO), [], 'un reembolso es final');
  });

  test('a remesado no se pasa a mano: solo lo pone la remesa (NG15)', () => {
    // Sin remesa, el recibo quedaba «en el banco» sin llegar a ningún fichero.
    assert.equal(puedeTransicionar(EstadoPago.PENDIENTE, EstadoPago.REMESADO), false);
    assert.equal(puedeTransicionar(EstadoPago.PENDIENTE, EstadoPago.REMESADO, { remesaId: null }), false);
  });

  test('un remesado sin remesa puede volver a pendiente; con remesa, no', () => {
    assert.ok(puedeTransicionar(EstadoPago.REMESADO, EstadoPago.PENDIENTE, { remesaId: null }));
    assert.equal(puedeTransicionar(EstadoPago.REMESADO, EstadoPago.PENDIENTE, { remesaId: 7 }), false);
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
    // rastro del intento de cobro. (La única excepción, el remesado sin
    // remesa, tiene su propia prueba.)
    for (const origen of TODOS) {
      assert.equal(
        puedeTransicionar(origen, EstadoPago.PENDIENTE, { remesaId: 1 }),
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

  test('se cobra desde pendiente y también desde remesado', () => {
    // Un remesado es un cobro en curso: antes no había forma de darlo por
    // cobrado y se quedaba en un callejón sin salida.
    assert.ok(puedeCobrarse(EstadoPago.PENDIENTE));
    assert.ok(puedeCobrarse(EstadoPago.REMESADO));
    for (const estado of [EstadoPago.PAGADO, ...ESTADOS_FINALES]) {
      assert.equal(puedeCobrarse(estado), false, `${estado} no debería poder cobrarse`);
    }
  });

  test('un remesado solo lo cobra el banco: por domiciliación, nunca en mano', () => {
    // Con la remesa en el banco, cobrarlo en efectivo lo cobraría dos veces.
    assert.deepEqual(estadosCobrablesCon(MetodoPago.DOMICILIACION), [EstadoPago.PENDIENTE, EstadoPago.REMESADO]);
    assert.deepEqual(estadosCobrablesCon(undefined), [EstadoPago.PENDIENTE, EstadoPago.REMESADO], 'sin método, el del banco');
    for (const metodo of [MetodoPago.EFECTIVO, MetodoPago.TARJETA, MetodoPago.BIZUM, MetodoPago.TRANSFERENCIA]) {
      assert.deepEqual(estadosCobrablesCon(metodo), [EstadoPago.PENDIENTE], metodo);
    }
  });

  test('devolver o anular el recibo deja sin efecto la papeleta; eximirlo no', () => {
    assert.ok(anulaPapeleta(EstadoPago.DEVUELTO));
    assert.ok(anulaPapeleta(EstadoPago.ANULADO));
    assert.equal(anulaPapeleta(EstadoPago.EXENTO), false);
    assert.equal(anulaPapeleta(EstadoPago.REMESADO), false);
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
