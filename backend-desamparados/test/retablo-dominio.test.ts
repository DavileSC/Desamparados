// Qué foto toca hoy en el retablo del Inicio del CMS: sin base de datos.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { diasHasta, esDiaDelAnio, tiempoDeHoy, tramoDelTiempo, type TiempoDelRetablo } from '../src/domain/retablo.js';

const foto = (n: number) => ({ foto: `/storage/public/${String(n).repeat(32)}.webp`, x: 50, y: 30 });
const CUARESMA: TiempoDelRetablo = { tiempo: 'cuaresma', ...foto(1) };
const SEMANA_SANTA: TiempoDelRetablo = { tiempo: 'semana-santa', ...foto(2) };
const NAVIDAD: TiempoDelRetablo = { tiempo: 'navidad', ...foto(3) };
const MAYO: TiempoDelRetablo = { tiempo: 'a-mano', nombre: 'Mes de mayo', desde: '05-01', hasta: '05-31', ...foto(4) };

describe('los tiempos del retablo', () => {
  test('la Cuaresma va de la Ceniza a la Resurrección, y la Semana Santa de Ramos a la Resurrección', () => {
    // En 2027 la Pascua es el 28 de marzo.
    assert.deepEqual(tramoDelTiempo(CUARESMA, 2027), { desde: '2027-02-10', hasta: '2027-03-28' });
    assert.deepEqual(tramoDelTiempo(SEMANA_SANTA, 2027), { desde: '2027-03-21', hasta: '2027-03-28' });
  });

  test('sin tiempo para hoy, ninguno: va la foto de todo el año', () => {
    assert.equal(tiempoDeHoy([CUARESMA, MAYO], '2026-10-05'), null);
  });

  test('en Semana Santa manda la Semana Santa aunque también sea Cuaresma: gana el más corto', () => {
    assert.equal(tiempoDeHoy([CUARESMA, SEMANA_SANTA], '2027-03-24'), SEMANA_SANTA);
    assert.equal(tiempoDeHoy([CUARESMA, SEMANA_SANTA], '2027-03-01'), CUARESMA);
  });

  test('los tramos que dan la vuelta al año cuentan en enero, y los extremos se incluyen', () => {
    assert.equal(tiempoDeHoy([NAVIDAD], '2027-01-03'), NAVIDAD);
    assert.equal(tiempoDeHoy([NAVIDAD], '2026-12-24'), NAVIDAD);
    assert.equal(tiempoDeHoy([NAVIDAD], '2027-01-07'), null);
    const invierno: TiempoDelRetablo = { tiempo: 'a-mano', nombre: 'Invierno', desde: '12-15', hasta: '02-15', ...foto(5) };
    assert.equal(tiempoDeHoy([invierno], '2027-02-15'), invierno);
    assert.equal(tiempoDeHoy([invierno], '2026-12-14'), null);
  });

  test('a igual duración, el primero de la lista', () => {
    const otroMayo: TiempoDelRetablo = { ...MAYO, nombre: 'Otro mayo', ...foto(6) };
    assert.equal(tiempoDeHoy([MAYO, otroMayo], '2027-05-13'), MAYO);
  });

  test('los días del año en MM-DD, con el 29 de febrero', () => {
    assert.equal(esDiaDelAnio('02-29'), true);
    assert.equal(esDiaDelAnio('02-30'), false);
    assert.equal(esDiaDelAnio('13-01'), false);
    assert.equal(esDiaDelAnio('5-1'), false);
  });

  test('los días que faltan, con 0 el mismo día y sin tropezar con el cambio de hora', () => {
    assert.equal(diasHasta('2026-10-05', '2026-10-05'), 0);
    assert.equal(diasHasta('2026-10-05', '2027-03-20'), 166);
  });
});
