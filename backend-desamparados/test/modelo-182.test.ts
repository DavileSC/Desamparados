// El Modelo 182 sin base de datos: el NIF, la provincia, la recurrencia, el
// porcentaje y el fichero con sus 250 caracteres por línea en su sitio.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { naturalezaDelNif, nifValido, normalizarNif } from '../src/domain/nif.js';
import {
  declaradosDelEjercicio, esRecurrente, ficheroModelo182, porcentajeDe, provinciaDelCodigoPostal, textoAeat,
  justificantePorDefecto, type Aportacion,
} from '../src/domain/modelo-182.js';

test('NIF: DNI, NIE y CIF con su control; y su naturaleza', () => {
  assert.equal(normalizarNif('1.234.567-l'), '01234567L');
  assert.ok(nifValido('12345678Z'));
  assert.ok(!nifValido('12345678A'));
  assert.ok(nifValido('X1234567L'));
  assert.ok(nifValido('B12345674'), 'una sociedad limitada lleva cifra');
  assert.ok(!nifValido('B1234567D'));
  assert.ok(nifValido('R2900001E'), 'una entidad religiosa lleva letra');
  assert.equal(naturalezaDelNif('12345678Z'), 'F');
  assert.equal(naturalezaDelNif('B12345674'), 'J');
  assert.equal(naturalezaDelNif('E12345674'), 'E');
});

test('la provincia sale del código postal; fuera de España, nada', () => {
  assert.equal(provinciaDelCodigoPostal('29006'), '29');
  assert.equal(provinciaDelCodigoPostal('01001'), '01');
  assert.equal(provinciaDelCodigoPostal('53000'), null);
  assert.equal(provinciaDelCodigoPostal(null), null);
});

test('recurrente: dio los dos años anteriores, y cada año lo mismo o más', () => {
  const m = (pares: [number, number][]) => new Map(pares);
  assert.ok(esRecurrente(m([[2025, 50], [2024, 50]]), 2026));
  assert.ok(esRecurrente(m([[2025, 60], [2024, 50], [2023, 50]]), 2026));
  assert.ok(!esRecurrente(m([[2025, 40], [2024, 50]]), 2026), 'bajó el último año');
  assert.ok(!esRecurrente(m([[2025, 50], [2024, 50], [2023, 70]]), 2026), 'el de antes era menos que el anterior a él');
  assert.ok(!esRecurrente(m([[2025, 50]]), 2026));
});

test('porcentajes de la Ley 49/2002 desde 2024', () => {
  assert.equal(porcentajeDe('F', 250_00, false), 80);
  assert.equal(porcentajeDe('F', 250_01, false), 40);
  assert.equal(porcentajeDe('F', 300_00, true), 45);
  assert.equal(porcentajeDe('J', 100_00, false), 40);
  assert.equal(porcentajeDe('J', 100_00, true), 50);
});

const aportacion = (o: Partial<Aportacion>): Aportacion => ({
  nif: '12345678Z', nifRepresentante: null, apellidosYNombre: 'RUIZ GIL ANA', nombre: 'Ana Ruiz Gil',
  codigoPostal: '29006', email: null, centimos: 30_00, fecha: '2026-03-01', concepto: 'Cuota', ...o,
});

test('se junta todo lo de un NIF del ejercicio y los años de antes deciden si es recurrente', () => {
  const declarados = declaradosDelEjercicio([
    aportacion({}),
    aportacion({ fecha: '2026-10-01', centimos: 20_00, codigoPostal: '41001' }),
    aportacion({ fecha: '2025-03-01', centimos: 40_00 }),
    aportacion({ fecha: '2024-03-01', centimos: 40_00 }),
    aportacion({ nif: 'X1234567L', fecha: '2025-05-05' }), // solo el año anterior: no se declara este
  ], 2026);
  assert.equal(declarados.length, 1);
  const [d] = declarados;
  assert.equal(d.centimos, 50_00);
  assert.equal(d.recurrente, true);
  assert.equal(d.porcentaje, 80, 'no pasa de 250 €');
  assert.equal(d.provincia, '41', 'la del último código postal');
  assert.equal(d.aportaciones.length, 2);
});

test('el fichero: líneas de 250, campos en su posición y en mayúsculas sin tildes', () => {
  assert.equal(textoAeat('Muñoz Pérez, José-María'), 'MUÑOZ PEREZ JOSE MARIA');
  const declarados = declaradosDelEjercicio([
    aportacion({ centimos: 300_50 }),
    aportacion({ nif: 'B12345674', apellidosYNombre: 'TALLERES SL', nombre: 'Talleres SL', centimos: 100_00 }),
  ], 2026);
  const texto = ficheroModelo182({
    nif: 'R2900001E', denominacion: 'Grupo Parroquial Nuestra Señora de los Desamparados', telefono: '644 90 01 67',
    contacto: 'Pérez López Juan', justificante: justificantePorDefecto(2026),
  }, 2026, declarados);
  const lineas = texto.split('\r\n');
  assert.equal(lineas.pop(), '', 'acaba en salto de línea');
  assert.equal(lineas.length, 3);
  for (const l of lineas) assert.equal(l.length, 250);

  const [uno, persona, empresa] = lineas.slice(0, 1).concat(lineas.slice(1).sort());
  const campo = (l: string, desde: number, hasta: number) => l.slice(desde - 1, hasta);
  assert.equal(campo(uno, 1, 8), '11822026');
  assert.equal(campo(uno, 9, 17), 'R2900001E');
  assert.equal(campo(uno, 18, 57).trimEnd(), 'GRUPO PARROQUIAL NUESTRA SEÑORA DE LOS D');
  assert.equal(campo(uno, 58, 58), 'T');
  assert.equal(campo(uno, 59, 67), '644900167');
  assert.equal(campo(uno, 108, 120), '1822026000001');
  assert.equal(campo(uno, 136, 144), '000000002');
  assert.equal(campo(uno, 145, 159), '000000000040050', '400,50 €');
  assert.equal(campo(uno, 160, 160), '1');

  assert.equal(campo(persona, 18, 26), '12345678Z');
  assert.equal(campo(persona, 36, 75).trimEnd(), 'RUIZ GIL ANA');
  assert.equal(campo(persona, 76, 77), '29');
  assert.equal(campo(persona, 78, 78), 'A');
  assert.equal(campo(persona, 79, 83), '04000', 'pasa de 250 €: el 40 % del tramo de arriba');
  assert.equal(campo(persona, 84, 96), '0000000030050');
  assert.equal(campo(persona, 105, 105), 'F');
  assert.equal(campo(persona, 132, 132), '2', 'no es recurrente');

  assert.equal(campo(empresa, 18, 26), 'B12345674');
  assert.equal(campo(empresa, 79, 83), '04000');
  assert.equal(campo(empresa, 105, 105), 'J');
});
