// Esquemas de recibos y procesión, sin base de datos. Se prueban tal y como
// los aplica `validate`: con las claves no declaradas borradas en profundidad.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors, type Type } from 'arktype';
import {
  adminRecibosQuerySchema,
  buscarHermanosQuerySchema,
  emitirReciboSchema,
  generarCuotasSchema,
  misRecibosQuerySchema,
} from '../src/schemas/recibo.schema.js';
import {
  avisarAsistenciaSchema,
  inscribirManualSchema,
  misPapeletasQuerySchema,
  procesarAusenciasSchema,
} from '../src/schemas/procesion.schema.js';

function validar(esquema: Type<any>, entrada: Record<string, unknown>) {
  return esquema.onDeepUndeclaredKey('delete')({ body: undefined, query: {}, params: {}, ...entrada });
}
const valido = (r: unknown) => !(r instanceof ArkErrors);

describe('S10 · consultas de recibos', () => {
  test('un parámetro repetido llega como lista en Express 5 y es un 400, no un 500', () => {
    assert.equal(valido(validar(adminRecibosQuerySchema, { query: { estado: ['PENDIENTE', 'PAGADO'] } })), false);
    assert.equal(valido(validar(adminRecibosQuerySchema, { query: { year: ['2026', '2025'] } })), false);
    assert.equal(valido(validar(misRecibosQuerySchema, { query: { page: ['1', '2'] } })), false);
    assert.equal(valido(validar(misPapeletasQuerySchema, { query: { limit: ['5', '50'] } })), false);
  });

  test('un estado que no existe o un año que no es un año, tampoco', () => {
    assert.equal(valido(validar(adminRecibosQuerySchema, { query: { estado: 'COBRADO' } })), false);
    assert.equal(valido(validar(adminRecibosQuerySchema, { query: { year: '20' } })), false);
  });

  test('los filtros válidos y la paginación sobreviven a la validación', () => {
    const r = validar(adminRecibosQuerySchema, { query: { year: '2026', estado: 'REMESADO', page: '2', limit: '50' } }) as { query: Record<string, string> };
    assert.deepEqual(r.query, { year: '2026', estado: 'REMESADO', page: '2', limit: '50' });
    const m = validar(misPapeletasQuerySchema, { query: { page: '2', limit: '5' } }) as { query: Record<string, string> };
    assert.deepEqual(m.query, { page: '2', limit: '5' });
  });

  test('el buscador de hermanos pide al menos dos letras', () => {
    assert.equal(valido(validar(buscarHermanosQuerySchema, { query: { q: 'a' } })), false);
    assert.equal(valido(validar(buscarHermanosQuerySchema, { query: {} })), false);
    assert.ok(valido(validar(buscarHermanosQuerySchema, { query: { q: 'ana' } })));
  });
});

describe('D14 · generar cuotas', () => {
  test('un año con decimales es un 400, no un 500 de Prisma', () => {
    assert.equal(valido(validar(generarCuotasSchema, { body: { year: 2026.5, importe: 25, concepto: 'Cuota anual' } })), false);
    assert.ok(valido(validar(generarCuotasSchema, { body: { year: 2026, importe: 25.5, concepto: 'Cuota anual' } })));
  });

  test('el importe tiene dos decimales como mucho y es positivo', () => {
    assert.equal(valido(validar(generarCuotasSchema, { body: { year: 2026, importe: 25.505, concepto: 'Cuota' } })), false);
    assert.equal(valido(validar(generarCuotasSchema, { body: { year: 2026, importe: 0, concepto: 'Cuota' } })), false);
  });
});

describe('D3 · emitir un recibo suelto', () => {
  const base = { hermanoId: 7, year: 2026, concepto: 'Cuota anual (reemisión)', importe: 25, tipo: 'CUOTA_HERMANO' };

  test('con hermano, año, concepto, importe y tipo es válido', () => {
    assert.ok(valido(validar(emitirReciboSchema, { body: base })));
  });

  test('las papeletas no se emiten sueltas: nacen en la mesa con su papeleta', () => {
    assert.equal(valido(validar(emitirReciboSchema, { body: { ...base, tipo: 'PAPELETA_SITIO' } })), false);
  });

  test('rechaza importes negativos, años con decimales, hermanos inventados y conceptos con HTML', () => {
    assert.equal(valido(validar(emitirReciboSchema, { body: { ...base, importe: -5 } })), false);
    assert.equal(valido(validar(emitirReciboSchema, { body: { ...base, year: 2026.5 } })), false);
    assert.equal(valido(validar(emitirReciboSchema, { body: { ...base, hermanoId: 1.5 } })), false);
    assert.equal(valido(validar(emitirReciboSchema, { body: { ...base, concepto: '<b>Cuota</b>' } })), false);
    assert.equal(valido(validar(emitirReciboSchema, { body: { ...base, concepto: 'x'.repeat(151) } })), false);
  });

  test('no deja colar el estado: todo recibo emitido nace pendiente', () => {
    const r = validar(emitirReciboSchema, { body: { ...base, estado: 'PAGADO' } }) as { body: Record<string, unknown> };
    assert.equal(r.body.estado, undefined);
  });
});

describe('D4 · inscripción en mesa', () => {
  const inscripcion = { hermanoId: 3, metodoPago: 'EFECTIVO', puesto: 'Cirio' };

  test('ya no exige un importe', () => {
    assert.ok(valido(validar(inscribirManualSchema, { body: inscripcion })));
  });

  test('y si alguien lo manda, se descarta: el importe lo pone el servidor', () => {
    const r = validar(inscribirManualSchema, { body: { ...inscripcion, importe: 0.01 } }) as { body: Record<string, unknown> };
    assert.equal(r.body.importe, undefined);
  });

  test('los identificadores son enteros', () => {
    assert.equal(valido(validar(avisarAsistenciaSchema, { body: { turnoId: 1.5, hermanoId: 2 } })), false);
    assert.equal(valido(validar(inscribirManualSchema, { body: { ...inscripcion, citaId: 2.5 } })), false);
  });
});

describe('P5 · procesar ausencias', () => {
  test('sin cuerpo es válido: la fecha límite es ahora', () => {
    assert.ok(valido(validar(procesarAusenciasSchema, {})));
  });

  test('una fecha pasada vale', () => {
    const r = validar(procesarAusenciasSchema, { body: { fechaLimite: '2026-01-01', cierreDefinitivo: true } }) as { body: Record<string, unknown> };
    assert.deepEqual(r.body, { fechaLimite: '2026-01-01', cierreDefinitivo: true });
  });

  test('el día de hoy en Madrid vale a cualquier hora', () => {
    const hoyMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
    assert.ok(valido(validar(procesarAusenciasSchema, { body: { fechaLimite: hoyMadrid } })));
  });

  test('una fecha futura o ilegible es un 400', () => {
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    assert.equal(valido(validar(procesarAusenciasSchema, { body: { fechaLimite: manana } })), false);
    assert.equal(valido(validar(procesarAusenciasSchema, { body: { fechaLimite: 'el lunes' } })), false);
  });

  test('cierreDefinitivo tiene que ser booleano', () => {
    assert.equal(valido(validar(procesarAusenciasSchema, { body: { cierreDefinitivo: 'sí' } })), false);
  });
});
