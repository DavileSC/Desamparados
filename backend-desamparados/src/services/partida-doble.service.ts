/**
 * La partida doble de un ejercicio, sacada del libro de caja (la regla, en
 * `domain/partida-doble.ts`): el plan de cuentas de las categorías, el libro
 * diario, las sumas y saldos y la cuenta de resultados, y todo junto en Excel.
 */
import ExcelJS from 'exceljs';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { diaMadrid, inicioDiaMadrid } from '../domain/contabilidad.js';
import { aCentimos } from '../domain/sepa.js';
import {
  PLAN, cuentaDeResultados, cuentaPropuesta, esCuentaDelPlan, libroDiario, nombreDeCuenta, sumasYSaldos, type ApunteDeCaja, type TraspasoABanco,

} from '../domain/partida-doble.js';

/** Céntimos → euros, como número (no como texto: para eso, utils/euros.ts). */
const centimosAEuros = (centimos: number) => centimos / 100;

/** Las categorías con la cuenta que usan: la asignada o, si no, la propuesta. */
async function planDeCategorias() {
  const categorias = await db.categoriaTransaccion.findMany({
    select: { id: true, nombre: true, tipo: true, activa: true, cuentaContable: true },
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }, { id: 'asc' }],
  });
  return categorias.map((c) => {
    const cuenta = c.cuentaContable ?? cuentaPropuesta(c.nombre, c.tipo);
    return { ...c, cuenta, nombreCuenta: nombreDeCuenta(cuenta), propuesta: c.cuentaContable === null };
  });
}

async function asientosDelEjercicio(anio: number) {
  const plan = await planDeCategorias();
  const cuentaDe = new Map(plan.map((c) => [c.id, c.cuenta]));
  const apuntes = await db.transaccion.findMany({
    where: { fecha: { gte: inicioDiaMadrid(`${anio}-01-01`), lt: inicioDiaMadrid(`${anio + 1}-01-01`) } },
    select: { id: true, fecha: true, concepto: true, tipo: true, importe: true, metodoPago: true, categoriaId: true },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });
  const deCaja: ApunteDeCaja[] = apuntes.map((a) => ({
    id: a.id, fecha: diaMadrid(a.fecha), concepto: a.concepto, tipo: a.tipo, centimos: aCentimos(a.importe),
    metodoPago: a.metodoPago, cuentaCategoria: cuentaDe.get(a.categoriaId)!,
  }));
  // El efectivo de la tienda llevado al banco: de Caja a Bancos.
  const ingresos = await db.ingresoEfectivoTienda.findMany({
    where: { fecha: { gte: inicioDiaMadrid(`${anio}-01-01`), lt: inicioDiaMadrid(`${anio + 1}-01-01`) } },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });
  const traspasos: TraspasoABanco[] = ingresos.map((i) => ({
    id: i.id, fecha: diaMadrid(i.fecha), concepto: 'Tienda: efectivo ingresado en el banco', centimos: aCentimos(i.importe),
  }));
  return { plan, asientos: libroDiario(deCaja, traspasos) };
}

export class PartidaDobleService {
  /** El plan de cuentas que se puede elegir y las categorías con la suya. */
  static async plan() {
    return { cuentas: PLAN, categorias: await planDeCategorias() };
  }

  /** Cambia la cuenta de una categoría; `null` vuelve a la propuesta por el nombre. */
  static async asignarCuenta(categoriaId: number, cuenta: string | null, meta?: MetaDeAuditoria) {
    const categoria = await db.categoriaTransaccion.findUnique({ where: { id: categoriaId }, select: { id: true, nombre: true, cuentaContable: true } });
    if (!categoria) throw new NotFoundError('Categoría no encontrada.');
    if (cuenta !== null && !esCuentaDelPlan(cuenta)) throw new HttpError(`La cuenta ${cuenta} no está en el plan.`);
    await db.categoriaTransaccion.update({ where: { id: categoriaId }, data: { cuentaContable: cuenta } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CATEGORIA_CUENTA, meta ?? {}, 'categoria', categoriaId, {
      antes: { cuenta: categoria.cuentaContable }, despues: { cuenta },
    });
    return PartidaDobleService.plan();
  }

  /** Sumas y saldos, cuenta de resultados y cuántos asientos tiene el ejercicio. */
  static async ejercicio(anio: number) {
    const { plan, asientos } = await asientosDelEjercicio(anio);
    const sumas = sumasYSaldos(asientos);
    const resultados = cuentaDeResultados(sumas);
    return {
      anio,
      asientos: asientos.length,
      categoriasPropuestas: plan.filter((c) => c.propuesta).length,
      sumas: sumas.map((s) => ({ ...s, debe: centimosAEuros(s.debe), haber: centimosAEuros(s.haber), saldo: centimosAEuros(s.saldo) })),
      resultados: {
        ingresos: resultados.ingresos.map((x) => ({ ...x, importe: centimosAEuros(x.importe) })),
        gastos: resultados.gastos.map((x) => ({ ...x, importe: centimosAEuros(x.importe) })),
        totalIngresos: centimosAEuros(resultados.totalIngresos),
        totalGastos: centimosAEuros(resultados.totalGastos),
        excedente: centimosAEuros(resultados.excedente),
      },
    };
  }

  /** Una página del libro diario, del asiento `desde` en adelante. */
  static async diario(anio: number, pagina: number, porPagina: number) {
    const { asientos } = await asientosDelEjercicio(anio);
    const trozo = asientos.slice((pagina - 1) * porPagina, pagina * porPagina);
    return {
      total: asientos.length,
      pagina,
      porPagina,
      asientos: trozo.map((a) => ({
        ...a,
        lineas: a.lineas.map((l) => ({ cuenta: l.cuenta, nombre: nombreDeCuenta(l.cuenta), debe: centimosAEuros(l.debe), haber: centimosAEuros(l.haber) })),
      })),
    };
  }

  /** El ejercicio en Excel: diario, sumas y saldos y cuenta de resultados, cada uno en su hoja. */
  static async excel(anio: number, meta?: MetaDeAuditoria) {
    const { asientos } = await asientosDelEjercicio(anio);
    const sumas = sumasYSaldos(asientos);
    const r = cuentaDeResultados(sumas);
    const libro = new ExcelJS.Workbook();
    const dinero = '#,##0.00 [$€-es-ES];-#,##0.00 [$€-es-ES]';

    const diario = libro.addWorksheet('Libro diario', { views: [{ state: 'frozen', ySplit: 1 }] });
    diario.columns = [
      { header: 'Asiento', key: 'numero', width: 9 }, { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Cuenta', key: 'cuenta', width: 9 }, { header: 'Nombre de la cuenta', key: 'nombre', width: 42 },
      { header: 'Concepto', key: 'concepto', width: 42 }, { header: 'Debe', key: 'debe', width: 13, style: { numFmt: dinero } },
      { header: 'Haber', key: 'haber', width: 13, style: { numFmt: dinero } },
    ];
    for (const a of asientos) {
      for (const l of a.lineas) {
        diario.addRow({ numero: a.numero, fecha: new Date(`${a.fecha}T00:00:00Z`), cuenta: l.cuenta, nombre: nombreDeCuenta(l.cuenta), concepto: a.concepto, debe: l.debe ? centimosAEuros(l.debe) : null, haber: l.haber ? centimosAEuros(l.haber) : null });
      }
    }
    diario.getColumn('fecha').numFmt = 'dd/mm/yyyy';

    const hojaSumas = libro.addWorksheet('Sumas y saldos');
    hojaSumas.columns = [
      { header: 'Cuenta', key: 'cuenta', width: 9 }, { header: 'Nombre de la cuenta', key: 'nombre', width: 42 },
      { header: 'Debe', key: 'debe', width: 14, style: { numFmt: dinero } }, { header: 'Haber', key: 'haber', width: 14, style: { numFmt: dinero } },
      { header: 'Saldo deudor', key: 'deudor', width: 14, style: { numFmt: dinero } }, { header: 'Saldo acreedor', key: 'acreedor', width: 14, style: { numFmt: dinero } },
    ];
    for (const s of sumas) hojaSumas.addRow({ cuenta: s.cuenta, nombre: s.nombre, debe: centimosAEuros(s.debe), haber: centimosAEuros(s.haber), deudor: s.saldo > 0 ? centimosAEuros(s.saldo) : null, acreedor: s.saldo < 0 ? centimosAEuros(-s.saldo) : null });
    hojaSumas.addRow({ nombre: 'Total', debe: centimosAEuros(sumas.reduce((t, s) => t + s.debe, 0)), haber: centimosAEuros(sumas.reduce((t, s) => t + s.haber, 0)) }).font = { bold: true };

    const hojaResultados = libro.addWorksheet('Cuenta de resultados');
    hojaResultados.columns = [{ header: 'Cuenta', key: 'cuenta', width: 9 }, { header: 'Concepto', key: 'nombre', width: 48 }, { header: 'Importe', key: 'importe', width: 16, style: { numFmt: dinero } }];
    hojaResultados.addRow({ nombre: 'Ingresos de la actividad' }).font = { bold: true };
    for (const x of r.ingresos) hojaResultados.addRow({ cuenta: x.cuenta, nombre: x.nombre, importe: centimosAEuros(x.importe) });
    hojaResultados.addRow({ nombre: 'Total ingresos', importe: centimosAEuros(r.totalIngresos) }).font = { bold: true };
    hojaResultados.addRow({});
    hojaResultados.addRow({ nombre: 'Gastos de la actividad' }).font = { bold: true };
    for (const x of r.gastos) hojaResultados.addRow({ cuenta: x.cuenta, nombre: x.nombre, importe: centimosAEuros(-x.importe) });
    hojaResultados.addRow({ nombre: 'Total gastos', importe: centimosAEuros(-r.totalGastos) }).font = { bold: true };
    hojaResultados.addRow({});
    hojaResultados.addRow({ nombre: 'Excedente del ejercicio', importe: centimosAEuros(r.excedente) }).font = { bold: true };

    for (const hoja of [diario, hojaSumas, hojaResultados]) hoja.getRow(1).font = { bold: true };
    await AuditoriaService.log(ACCIONES_AUDITORIA.CONTABILIDAD_EXPORTAR, meta ?? {}, 'ejercicio', anio, { despues: { anio, asientos: asientos.length } });
    return { contenido: Buffer.from(await libro.xlsx.writeBuffer()), nombre: `contabilidad-${anio}.xlsx` };
  }
}
