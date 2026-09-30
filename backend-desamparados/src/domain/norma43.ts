/**
 * El extracto del banco en Norma 43 (AEB/CSB 43): lo que Tesorería descarga de
 * la banca en línea para casar las remesas con lo que de verdad pasó.
 *
 * Registros de 80 caracteres, uno por línea, con el tipo en las dos primeras
 * posiciones:
 *   11  cabecera de cuenta (entidad, oficina, cuenta, fechas, saldo inicial)
 *   22  movimiento (fechas, concepto, cargo o abono, importe, referencias)
 *   23  complementos del movimiento (hasta cinco, 2 × 38 caracteres de texto)
 *   24  equivalencia de divisa (se ignora)
 *   33  final de cuenta (número y suma de cargos y abonos, saldo final)
 *   88  fin de fichero
 *
 * Todo puro. El casado busca en el texto del movimiento lo que la remesa
 * mandó al banco: el EndToEndId del adeudo (`REC-123`) o la referencia del
 * mandato (`HERMANO-000045-20260930`), que el banco repite en la devolución.
 */

export type Signo = 'CARGO' | 'ABONO';

export interface MovimientoN43 {
  /** Línea del fichero donde empieza (para los mensajes). */
  linea: number;
  fechaOperacion: string;
  fechaValor: string;
  conceptoComun: string;
  conceptoPropio: string;
  signo: Signo;
  centimos: number;
  documento: string;
  referencia1: string;
  referencia2: string;
  /** El texto de los registros 23, en orden. */
  conceptos: string[];
}

export interface CuentaN43 {
  entidad: string;
  oficina: string;
  cuenta: string;
  desde: string;
  hasta: string;
  /** Con signo: negativo si el saldo es deudor. */
  saldoInicial: number;
  saldoFinal: number | null;
  titular: string;
  movimientos: MovimientoN43[];
}

export interface ExtractoN43 {
  cuentas: CuentaN43[];
  /** Lo que no cuadra o no se entiende: el fichero no se aplica si hay alguno. */
  errores: string[];
}

/** «260930» → «2026-09-30». La norma usa dos cifras de año: 2000 en adelante. */
function fecha(aammdd: string): string | null {
  if (!/^\d{6}$/.test(aammdd)) return null;
  const mes = Number(aammdd.slice(2, 4));
  const dia = Number(aammdd.slice(4, 6));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `20${aammdd.slice(0, 2)}-${aammdd.slice(2, 4)}-${aammdd.slice(4, 6)}`;
}

const importe = (texto: string): number | null => (/^\d{14}$/.test(texto) ? Number(texto) : null);

/** Clave de debe/haber: 1 es cargo (sale dinero), 2 es abono (entra). */
const signoDe = (clave: string): Signo | null => (clave === '1' ? 'CARGO' : clave === '2' ? 'ABONO' : null);

/**
 * Lee el fichero entero. No se detiene en el primer error: los junta todos,
 * para que Tesorería sepa de una vez si ha subido otra cosa o un fichero roto.
 */
export function leerNorma43(contenido: string): ExtractoN43 {
  const cuentas: CuentaN43[] = [];
  const errores: string[] = [];
  let actual: CuentaN43 | null = null;
  let ultimo: MovimientoN43 | null = null;
  let finDeFichero = false;

  const lineas = contenido.replace(/^﻿/, '').split(/\r?\n/);
  lineas.forEach((cruda, i) => {
    const n = i + 1;
    if (cruda.trim() === '') return;
    // Algunos bancos recortan los espacios del final: se rellenan hasta 80.
    const l = cruda.replace(/\s+$/, '').padEnd(80, ' ');
    if (l.length > 80) { errores.push(`Línea ${n}: tiene más de 80 caracteres; no parece un fichero Norma 43.`); return; }
    const tipo = l.slice(0, 2);

    switch (tipo) {
      case '11': {
        const desde = fecha(l.slice(20, 26));
        const hasta = fecha(l.slice(26, 32));
        const signo = signoDe(l.slice(32, 33));
        const saldo = importe(l.slice(33, 47));
        if (!desde || !hasta || !signo || saldo === null) { errores.push(`Línea ${n}: la cabecera de la cuenta no se entiende.`); actual = null; return; }
        actual = {
          entidad: l.slice(2, 6), oficina: l.slice(6, 10), cuenta: l.slice(10, 20), desde, hasta,
          saldoInicial: signo === 'CARGO' ? -saldo : saldo, saldoFinal: null, titular: l.slice(51, 77).trim(), movimientos: [],
        };
        cuentas.push(actual);
        ultimo = null;
        return;
      }
      case '22': {
        if (!actual) { errores.push(`Línea ${n}: un movimiento sin la cabecera de su cuenta.`); return; }
        const fechaOperacion = fecha(l.slice(10, 16));
        const fechaValor = fecha(l.slice(16, 22));
        const signo = signoDe(l.slice(27, 28));
        const centimos = importe(l.slice(28, 42));
        if (!fechaOperacion || !fechaValor || !signo || centimos === null) { errores.push(`Línea ${n}: el movimiento no se entiende.`); ultimo = null; return; }
        ultimo = {
          linea: n, fechaOperacion, fechaValor, conceptoComun: l.slice(22, 24), conceptoPropio: l.slice(24, 27), signo, centimos,
          documento: l.slice(42, 52).trim(), referencia1: l.slice(52, 64).trim(), referencia2: l.slice(64, 80).trim(), conceptos: [],
        };
        actual.movimientos.push(ultimo);
        return;
      }
      case '23': {
        if (!ultimo) { errores.push(`Línea ${n}: un concepto sin su movimiento.`); return; }
        ultimo.conceptos.push(...[l.slice(4, 42), l.slice(42, 80)].map((t) => t.trim()).filter(Boolean));
        return;
      }
      case '24':
        return;
      case '33': {
        if (!actual) { errores.push(`Línea ${n}: un final de cuenta sin su cabecera.`); return; }
        const cuenta: CuentaN43 = actual;
        const numCargos = Number(l.slice(20, 25));
        const totalCargos = importe(l.slice(25, 39));
        const numAbonos = Number(l.slice(39, 44));
        const totalAbonos = importe(l.slice(44, 58));
        const signo = signoDe(l.slice(58, 59));
        const saldo = importe(l.slice(59, 73));
        const cargos = cuenta.movimientos.filter((m) => m.signo === 'CARGO');
        const abonos = cuenta.movimientos.filter((m) => m.signo === 'ABONO');
        const suma = (ms: MovimientoN43[]) => ms.reduce((s, m) => s + m.centimos, 0);
        if (numCargos !== cargos.length || totalCargos !== suma(cargos) || numAbonos !== abonos.length || totalAbonos !== suma(abonos)) {
          errores.push(`Línea ${n}: los totales de la cuenta ${cuenta.cuenta} no cuadran con sus movimientos; el fichero puede estar incompleto.`);
        }
        if (signo && saldo !== null) {
          cuenta.saldoFinal = signo === 'CARGO' ? -saldo : saldo;
          if (cuenta.saldoFinal !== cuenta.saldoInicial - suma(cargos) + suma(abonos)) {
            errores.push(`Línea ${n}: el saldo final de la cuenta ${cuenta.cuenta} no cuadra con los movimientos.`);
          }
        }
        actual = null;
        ultimo = null;
        return;
      }
      case '88':
        finDeFichero = true;
        return;
      default:
        errores.push(`Línea ${n}: registro de tipo «${tipo}» desconocido; no parece un fichero Norma 43.`);
    }
  });

  if (cuentas.length === 0 && errores.length === 0) errores.push('El fichero no tiene ninguna cuenta: no parece un extracto Norma 43.');
  else if (!finDeFichero && errores.length === 0) errores.push('Falta el registro de fin de fichero (88): puede que el fichero esté cortado.');
  return { cuentas, errores };
}

// --- Casar los movimientos con lo que se mandó al banco -------------------

/** Todo el texto de un movimiento, para buscar en él las referencias. */
const textoDe = (m: MovimientoN43) => [m.documento, m.referencia1, m.referencia2, ...m.conceptos].join(' ').toUpperCase();

/** Los recibos que nombra un movimiento, por su EndToEndId (`REC-123`). */
export function recibosNombrados(m: MovimientoN43): number[] {
  return [...new Set([...textoDe(m).matchAll(/\bREC-(\d{1,9})\b/g)].map((x) => Number(x[1])))];
}

/** Los mandatos que nombra (`HERMANO-000045-20260930`): el id del hermano. */
export function hermanosNombrados(m: MovimientoN43): number[] {
  return [...new Set([...textoDe(m).matchAll(/\bHERMANO-(\d{6})-\d{8}\b/g)].map((x) => Number(x[1])))];
}

/** Lo justo de cada recibo que pudo ir al banco. */
export interface ReciboEnElBanco {
  id: number;
  hermanoId: number;
  centimos: number;
  remesaId: number;
}

/** Lo justo de cada remesa sin cobrar. */
export interface RemesaSinCobrar {
  id: number;
  mensajeId: string;
  fechaCobro: string;
  centimos: number;
}

export interface Casado {
  /** Cargos que son la devolución de un recibo de una remesa. */
  devoluciones: { movimiento: MovimientoN43; reciboId: number }[];
  /** Abonos que son el cobro de una remesa entera. */
  cobros: { movimiento: MovimientoN43; remesaId: number }[];
  /** Movimientos que parecen de una remesa, pero no se sabe de cuál recibo. */
  dudosos: { movimiento: MovimientoN43; motivo: string }[];
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Casa los movimientos del extracto con los recibos remesados y las remesas.
 *
 * - Una devolución es un cargo que nombra un recibo remesado (por su
 *   EndToEndId) y con su mismo importe; si solo nombra el mandato, vale cuando
 *   ese hermano tiene un único recibo remesado con ese importe.
 * - El cobro de una remesa es un abono que nombra su identificador o que, sin
 *   nombrarlo, trae su total exacto entre la fecha de cobro y diez días
 *   después. Si el importe casara con dos remesas, no se elige ninguna.
 * - El resto de movimientos (recibos de luz, donativos por transferencia…) no
 *   son de ninguna remesa y no se tocan.
 */
export function casarMovimientos(movimientos: MovimientoN43[], recibos: ReciboEnElBanco[], remesas: RemesaSinCobrar[]): Casado {
  const casado: Casado = { devoluciones: [], cobros: [], dudosos: [] };
  const porId = new Map(recibos.map((r) => [r.id, r]));
  const usados = new Set<number>();

  for (const m of movimientos) {
    if (m.signo === 'CARGO') {
      const nombrados = recibosNombrados(m).filter((id) => porId.has(id));
      if (nombrados.length === 1) {
        const recibo = porId.get(nombrados[0])!;
        if (recibo.centimos !== m.centimos) casado.dudosos.push({ movimiento: m, motivo: `Nombra el recibo ${recibo.id}, pero el importe no coincide.` });
        else if (usados.has(recibo.id)) casado.dudosos.push({ movimiento: m, motivo: `El recibo ${recibo.id} ya sale devuelto en otro movimiento.` });
        else { usados.add(recibo.id); casado.devoluciones.push({ movimiento: m, reciboId: recibo.id }); }
        continue;
      }
      if (nombrados.length > 1) { casado.dudosos.push({ movimiento: m, motivo: 'Nombra varios recibos a la vez.' }); continue; }
      const hermanos = hermanosNombrados(m);
      if (hermanos.length === 1) {
        const suyos = recibos.filter((r) => r.hermanoId === hermanos[0] && r.centimos === m.centimos && !usados.has(r.id));
        if (suyos.length === 1) { usados.add(suyos[0].id); casado.devoluciones.push({ movimiento: m, reciboId: suyos[0].id }); }
        else casado.dudosos.push({ movimiento: m, motivo: suyos.length === 0 ? 'Nombra un mandato sin recibos remesados con ese importe.' : 'Nombra un mandato con varios recibos del mismo importe.' });
      }
      continue;
    }

    const texto = textoDe(m);
    const porNombre = remesas.filter((r) => texto.includes(r.mensajeId.toUpperCase()));
    const porImporte = remesas.filter((r) => {
      const dias = diasEntre(r.fechaCobro, m.fechaValor);
      return r.centimos === m.centimos && dias >= 0 && dias <= 10;
    });
    const candidatas = porNombre.length > 0 ? porNombre : porImporte;
    if (candidatas.length === 1 && !casado.cobros.some((c) => c.remesaId === candidatas[0].id)) {
      casado.cobros.push({ movimiento: m, remesaId: candidatas[0].id });
    } else if (candidatas.length > 1) {
      casado.dudosos.push({ movimiento: m, motivo: 'El importe coincide con varias remesas: dala por cobrada a mano.' });
    }
  }
  return casado;
}
