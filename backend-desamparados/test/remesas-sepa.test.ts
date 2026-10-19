// Pruebas del fichero de remesas SEPA (domain/sepa.ts). No tocan la base: un
// fichero mal formado no falla aquí, lo rechaza el banco días después con el
// lote entero dentro. Fijan las sumas de control, los importes en céntimos, el
// juego de caracteres, las fechas hábiles y qué recibos se quedan fuera.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  aCentimos,
  avisoSinPlazo,
  clasificarRecibos,
  esDiaHabilBancario,
  esIdentificadorAcreedorValido,
  fechaCobroMinima,
  generarPain008,
  importeXml,
  leerAcreedorSepa,
  mensajeIdDeRemesa,
  problemaFechaCobro,
  referenciaMandato,
  renuevaMandato,
  textoSepa,
  type AcreedorSepa,
  type ReciboCandidato,
} from '../src/domain/sepa.js';
import { validarEntorno } from '../src/config/entorno.js';

const IBAN_VALIDO = 'ES9121000418450200051332';
const ACREEDOR: AcreedorSepa = { nombre: 'Grupo Parroquial de Prueba', id: 'ES26000G12345678', iban: IBAN_VALIDO, bic: null };

const candidato = (id: number, cambios: Partial<ReciboCandidato['hermano']> = {}, centimos = 3000): ReciboCandidato => ({
  id,
  concepto: 'Cuota anual 2026',
  centimos,
  hermano: {
    id: 100 + id, nombre: 'José', apellidos: 'Peña Núñez', activo: true, iban: IBAN_VALIDO,
    titularCuenta: null, fechaMandato: null, fechaAlta: new Date('2020-03-15T10:00:00Z'), ...cambios,
  },
});

describe('identificador de acreedor', () => {
  test('acepta uno con el control bien y rechaza el mismo con otro control', () => {
    assert.ok(esIdentificadorAcreedorValido('DE98ZZZ09999999999')); // el ejemplo publicado del Bundesbank
    assert.ok(esIdentificadorAcreedorValido('ES26000G12345678'));
    assert.ok(esIdentificadorAcreedorValido('es26 000 g12345678'));
    assert.ok(!esIdentificadorAcreedorValido('ES27000G12345678'));
    assert.ok(!esIdentificadorAcreedorValido('G12345678'));
  });

  test('el sufijo comercial no entra en el control', () => {
    assert.ok(esIdentificadorAcreedorValido('ES26ABCG12345678'));
  });

  test('sin datos del acreedor dice qué falta, y con ellos los normaliza', () => {
    const vacio = leerAcreedorSepa({});
    assert.equal(vacio.acreedor, null);
    assert.equal(vacio.problemas.length, 3);

    const mal = leerAcreedorSepa({ SEPA_ACREEDOR_NOMBRE: 'X', SEPA_ACREEDOR_ID: 'ES27000G12345678', SEPA_ACREEDOR_IBAN: 'ES0000', SEPA_ACREEDOR_BIC: 'X' });
    assert.equal(mal.acreedor, null);
    assert.equal(mal.problemas.length, 3);

    const bien = leerAcreedorSepa({
      SEPA_ACREEDOR_NOMBRE: 'Grupo Parroquial Ntra. Sra. de los Desamparados',
      SEPA_ACREEDOR_ID: 'es26000g12345678',
      SEPA_ACREEDOR_IBAN: 'ES91 2100 0418 4502 0005 1332',
      SEPA_ACREEDOR_BIC: 'caixesbbxxx',
    });
    assert.deepEqual(bien.acreedor, {
      nombre: 'Grupo Parroquial Ntra. Sra. de los Desamparados', id: 'ES26000G12345678', iban: IBAN_VALIDO, bic: 'CAIXESBBXXX',
    });
  });
});

describe('texto y dinero', () => {
  test('quita tildes y eñes, y lo que no admite el banco se vuelve espacio', () => {
    assert.equal(textoSepa('María Peña & Muñoz <Ávila>', 70), 'Maria Pena Munoz Avila');
    assert.equal(textoSepa('Cuota «2026» — 1.º plazo', 140), 'Cuota 2026 1. plazo');
    assert.equal(textoSepa('abcdefghij', 5), 'abcde');
  });

  test('los importes pasan a céntimos sin coma flotante', () => {
    assert.equal(aCentimos('30.00'), 3000);
    assert.equal(aCentimos('0.1'), 10);
    assert.equal(aCentimos('12.5'), 1250);
    assert.equal(aCentimos(0.1 + 0.2), 30);
    assert.equal(aCentimos('1234.05'), 123405);
    assert.equal(importeXml(123405), '1234.05');
    assert.equal(importeXml(5), '0.05');
  });
});

describe('calendario de los bancos', () => {
  test('cierran fines de semana, Viernes Santo, Lunes de Pascua y los festivos TARGET', () => {
    assert.ok(!esDiaHabilBancario('2026-10-03')); // sábado
    assert.ok(!esDiaHabilBancario('2026-04-03')); // Viernes Santo
    assert.ok(!esDiaHabilBancario('2026-04-06')); // Lunes de Pascua
    assert.ok(!esDiaHabilBancario('2026-12-25'));
    assert.ok(!esDiaHabilBancario('2025-12-26')); // viernes
    assert.ok(!esDiaHabilBancario('2027-05-01'));
    assert.ok(esDiaHabilBancario('2026-10-12')); // el Pilar es festivo en España, no en TARGET
  });

  test('el cobro necesita dos días hábiles de margen', () => {
    assert.equal(fechaCobroMinima('2026-09-30'), '2026-10-02'); // miércoles → viernes
    assert.equal(fechaCobroMinima('2026-10-01'), '2026-10-05'); // jueves → lunes
    assert.equal(fechaCobroMinima('2026-04-01'), '2026-04-07'); // salta la Semana Santa
  });

  test('explica por qué no vale una fecha de cobro', () => {
    assert.equal(problemaFechaCobro('2026-10-05', '2026-09-30'), null);
    assert.match(problemaFechaCobro('2026-10-01', '2026-09-30')!, /02\/10\/2026 o después/);
    assert.match(problemaFechaCobro('2026-10-03', '2026-09-30')!, /no abren/);
    assert.match(problemaFechaCobro('2026-13-01', '2026-09-30')!, /no es una fecha válida/);
    assert.match(problemaFechaCobro('2028-10-02', '2026-09-30')!, /más de un año/);
  });
});

describe('qué recibos van al banco', () => {
  test('deja fuera, con su motivo, al que no tiene cuenta, la tiene mal, está de baja o no debe nada', () => {
    const { adeudos, excluidos } = clasificarRecibos([
      candidato(1),
      candidato(2, { iban: null }),
      candidato(3, { iban: 'ES9121000418450200051333' }),
      candidato(4, { activo: false }),
      candidato(5, {}, 0),
    ]);
    assert.deepEqual(adeudos.map((a) => a.reciboId), [1]);
    assert.deepEqual(excluidos.map((e) => [e.reciboId, e.motivo]), [
      [2, 'SIN_IBAN'], [3, 'IBAN_NO_VALIDO'], [4, 'DE_BAJA'], [5, 'IMPORTE_CERO'],
    ]);
  });

  test('el mandato se firma al domiciliar; sin fecha, la del alta', () => {
    const [sinFecha, conFecha] = clasificarRecibos([
      candidato(1),
      candidato(2, { fechaMandato: new Date('2026-09-29T22:30:00Z') }), // 30-09 en Madrid
    ]).adeudos;
    assert.deepEqual(sinFecha.mandato, { referencia: 'HERMANO-000101-20200315', fechaFirma: '2020-03-15' });
    assert.deepEqual(conFecha.mandato, { referencia: 'HERMANO-000102-20260930', fechaFirma: '2026-09-30' });
    assert.equal(referenciaMandato(7, '2026-01-02'), 'HERMANO-000007-20260102');
  });

  test('el deudor es el titular de la cuenta si no es el propio hermano', () => {
    const [propio, otro] = clasificarRecibos([candidato(1), candidato(2, { titularCuenta: 'Ana Gómez', iban: 'es91 2100 0418 4502 0005 1332' })]).adeudos;
    assert.deepEqual(propio.deudor, { nombre: 'Jose Pena Nunez', iban: IBAN_VALIDO });
    assert.deepEqual(otro.deudor, { nombre: 'Ana Gomez', iban: IBAN_VALIDO });
  });
});

describe('el fichero pain.008', () => {
  const { adeudos } = clasificarRecibos([candidato(1), candidato(2, {}, 1250), candidato(3, {}, 5)]);
  const xml = generarPain008({
    mensajeId: mensajeIdDeRemesa(12, '2026-10-05'),
    creadaEl: new Date('2026-09-30T08:15:30.123Z'),
    fechaCobro: '2026-10-05',
    acreedor: ACREEDOR,
    adeudos,
  });
  const todos = (etiqueta: string) => [...xml.matchAll(new RegExp(`<${etiqueta}[^>]*>([^<]*)</${etiqueta}>`, 'g'))].map((m) => m[1]);

  test('cabecera y bloque llevan el mismo número de adeudos y la misma suma', () => {
    assert.deepEqual(todos('NbOfTxs'), ['3', '3']);
    assert.deepEqual(todos('CtrlSum'), ['42.55', '42.55']);
    assert.deepEqual(todos('InstdAmt'), ['30.00', '12.50', '0.05']);
  });

  test('identificadores, fechas y tipo de adeudo', () => {
    assert.deepEqual(todos('MsgId'), ['REMESA-000012-20261005']);
    assert.deepEqual(todos('PmtInfId'), ['REMESA-000012-20261005-1']);
    assert.deepEqual(todos('CreDtTm'), ['2026-09-30T08:15:30']);
    assert.deepEqual(todos('ReqdColltnDt'), ['2026-10-05']);
    assert.deepEqual(todos('SeqTp'), ['RCUR']);
    assert.deepEqual(todos('EndToEndId'), ['REC-1', 'REC-2', 'REC-3']);
    assert.deepEqual(todos('MndtId'), ['HERMANO-000101-20200315', 'HERMANO-000102-20200315', 'HERMANO-000103-20200315']);
    // El identificador del acreedor, en la cabecera y en el bloque.
    assert.equal(xml.split('ES26000G12345678').length - 1, 2);
  });

  test('es XML bien cerrado y sin caracteres fuera del juego SEPA en los textos', () => {
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    const etiquetas = [...xml.matchAll(/<(\/?)([A-Za-z]+)[^>]*?(\/?)>/g)].filter((m) => m[2] !== 'xml');
    const pila: string[] = [];
    for (const [, cierra, nombre, sola] of etiquetas) {
      if (sola) continue;
      if (cierra) assert.equal(pila.pop(), nombre);
      else pila.push(nombre);
    }
    assert.equal(pila.length, 0);
    for (const texto of [...todos('Nm'), ...todos('Ustrd')]) assert.match(texto, /^[A-Za-z0-9/\-?:().,'+ ]+$/);
  });

  test('sin BIC, el banco del acreedor va como NOTPROVIDED; con BIC, el BIC', () => {
    assert.ok(xml.includes('<CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>'));
    const conBic = generarPain008({ mensajeId: 'M', creadaEl: new Date(), fechaCobro: '2026-10-05', acreedor: { ...ACREEDOR, bic: 'CAIXESBBXXX' }, adeudos });
    assert.ok(conBic.includes('<CdtrAgt><FinInstnId><BIC>CAIXESBBXXX</BIC></FinInstnId></CdtrAgt>'));
  });

  test('una remesa vacía no se genera', () => {
    assert.throws(() => generarPain008({ mensajeId: 'M', creadaEl: new Date(), fechaCobro: '2026-10-05', acreedor: ACREEDOR, adeudos: [] }));
  });
});

describe('el mandato y el arranque', () => {
  test('se renueva al domiciliar y al cambiar de cuenta, no al cambiar otra cosa', () => {
    const domicilia = { formaPagoPref: 'DOMICILIACION', iban: IBAN_VALIDO };
    assert.ok(renuevaMandato({ formaPagoPref: 'EFECTIVO', iban: null }, domicilia));
    assert.ok(renuevaMandato(domicilia, { ...domicilia, iban: 'ES7921000813610123456789' }));
    assert.ok(!renuevaMandato(domicilia, { ...domicilia, iban: 'es91 2100 0418 4502 0005 1332' }));
    assert.ok(!renuevaMandato(domicilia, { formaPagoPref: 'EFECTIVO', iban: IBAN_VALIDO }));
  });

  test('el servidor no arranca con los datos del acreedor a medias o mal copiados', () => {
    const base = { NODE_ENV: 'development' };
    assert.deepEqual(validarEntorno(base).errores, []);
    assert.ok(validarEntorno({ ...base, SEPA_ACREEDOR_ID: 'ES26000G12345678' }).errores.some((e) => e.includes('SEPA_ACREEDOR_IBAN')));
    assert.deepEqual(validarEntorno({ ...base, SEPA_ACREEDOR_NOMBRE: 'Grupo', SEPA_ACREEDOR_ID: 'ES26000G12345678', SEPA_ACREEDOR_IBAN: IBAN_VALIDO }).errores, []);
  });
});

// El aviso a cada cuenta sale al generar la remesa: con menos de 14 días, se
// le dice a Tesorería (la norma los pide salvo pacto en el mandato), sin
// impedirle generarla.
test('el aviso del cargo con menos de 14 días de antelación se le dice a Tesorería', () => {
  assert.match(avisoSinPlazo('2026-10-02', '2026-09-30') ?? '', /menos de 14 días/);
  assert.match(avisoSinPlazo('2026-10-13', '2026-09-30') ?? '', /menos de 14 días/);
  assert.equal(avisoSinPlazo('2026-10-14', '2026-09-30'), null);
  assert.equal(avisoSinPlazo('no es fecha', '2026-09-30'), null);
});
