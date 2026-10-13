/**
 * El extracto del banco (Norma 43) contra las remesas: qué recibos devolvió el
 * banco y qué remesas abonó, sin marcarlos a mano uno a uno.
 *
 * Primero la vista previa, que no toca nada; después «aplicar», que vuelve a
 * leer el mismo fichero y hace lo que la vista previa enseñó, con las mismas
 * operaciones que Tesorería usaría a mano (devolver un recibo, dar una remesa
 * por cobrada): los asientos, la papeleta anulada y la auditoría salen igual.
 * Subir dos veces el mismo extracto no hace nada la segunda.
 */
import { EstadoPago, EstadoRemesa } from '@prisma/client';
import db from '../config/db';
import { HttpError } from '../utils/error.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { ReciboService } from './recibo.service.js';
import { RemesaService } from './remesa.service.js';
import { casarMovimientos, leerNorma43, recibosNombrados, type MovimientoN43 } from '../domain/norma43.js';
import { aCentimos } from '../domain/sepa.js';

/** Hasta dónde se mira atrás: una devolución SEPA CORE llega, como mucho, a los 13 meses. */
const MESES_ATRAS = 14;

/** Céntimos → euros, como número (no como texto: para eso, utils/euros.ts). */
const centimosAEuros = (centimos: number) => centimos / 100;
const cuentaEnmascarada = (cuenta: string) => `••••${cuenta.slice(-4)}`;
const textoMovimiento = (m: MovimientoN43) => [m.referencia1, m.referencia2, ...m.conceptos].filter(Boolean).join(' · ');

/**
 * Los recibos que nombran las devoluciones del extracto y no están entre los
 * remesados, con el porqué, para que vayan a dudosos con él.
 */
async function fueraDeLaLista(movimientos: MovimientoN43[], candidatos: Set<number>): Promise<Map<number, string>> {
  const ids = [...new Set(movimientos.filter((m) => m.signo === 'CARGO').flatMap(recibosNombrados))].filter((id) => !candidatos.has(id));
  if (ids.length === 0) return new Map();
  const leidos = await db.recibo.findMany({ where: { id: { in: ids } }, select: { id: true, estado: true, remesaId: true } });
  const vivos: EstadoPago[] = [EstadoPago.REMESADO, EstadoPago.PAGADO, EstadoPago.DEVUELTO];
  return new Map(leidos.map((r) => [r.id,
    !vivos.includes(r.estado) ? `está ${r.estado}`
      : r.remesaId === null ? 'no se mandó al banco en ninguna remesa'
        : `es de una remesa de hace más de ${MESES_ATRAS} meses`,
  ]));
}

async function analizar(contenido: string) {
  const extracto = leerNorma43(contenido);
  const movimientos = extracto.cuentas.flatMap((c) => c.movimientos);
  const desde = new Date();
  desde.setMonth(desde.getMonth() - MESES_ATRAS);

  const [recibos, remesas] = await Promise.all([
    db.recibo.findMany({
      where: {
        remesaId: { not: null },
        estado: { in: [EstadoPago.REMESADO, EstadoPago.PAGADO, EstadoPago.DEVUELTO] },
        remesa: { is: { createdAt: { gte: desde } } },
      },
      select: {
        id: true, concepto: true, importe: true, estado: true, remesaId: true,
        hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true } },
      },
    }),
    db.remesa.findMany({
      where: { createdAt: { gte: desde } },
      select: { id: true, mensajeId: true, fechaCobro: true, total: true, estado: true },
    }),
  ]);

  // Lo que siguen sumando los recibos de cada remesa: sin los anulados (o
  // vueltos a pendiente) después de generarla, que el banco cobra igual (ver
  // casarMovimientos). Un reembolsado sí cuenta: el banco lo cobró.
  const vivos = await db.recibo.groupBy({
    by: ['remesaId'],
    where: { remesaId: { in: remesas.map((r) => r.id) }, estado: { notIn: [EstadoPago.ANULADO, EstadoPago.EXENTO, EstadoPago.PENDIENTE] } },
    _sum: { importe: true },
  });
  const vivosPorRemesa = new Map(vivos.map((v) => [v.remesaId!, v._sum.importe ? aCentimos(v._sum.importe) : 0]));

  const casado = casarMovimientos(
    movimientos,
    recibos.map((r) => ({ id: r.id, hermanoId: r.hermano.id, centimos: aCentimos(r.importe), remesaId: r.remesaId! })),
    remesas.map((r) => ({
      id: r.id, mensajeId: r.mensajeId, fechaCobro: r.fechaCobro.toISOString().slice(0, 10), centimos: aCentimos(r.total),
      centimosVivos: vivosPorRemesa.get(r.id) ?? 0,
    })),
    await fueraDeLaLista(movimientos, new Set(recibos.map((r) => r.id))),
  );
  const reciboPorId = new Map(recibos.map((r) => [r.id, r]));
  const remesaPorId = new Map(remesas.map((r) => [r.id, r]));
  const tocados = new Set([...casado.devoluciones, ...casado.cobros, ...casado.dudosos].map((x) => x.movimiento));

  return {
    errores: extracto.errores,
    cuentas: extracto.cuentas.map((c) => ({
      cuenta: cuentaEnmascarada(c.cuenta), desde: c.desde, hasta: c.hasta, movimientos: c.movimientos.length,
    })),
    devoluciones: casado.devoluciones.map(({ movimiento, reciboId }) => {
      const r = reciboPorId.get(reciboId)!;
      return {
        reciboId, concepto: r.concepto, importe: Number(r.importe), estado: r.estado, fecha: movimiento.fechaValor,
        hermano: r.hermano, yaAplicado: r.estado === EstadoPago.DEVUELTO,
      };
    }),
    cobros: casado.cobros.map(({ movimiento, remesaId }) => {
      const r = remesaPorId.get(remesaId)!;
      return {
        remesaId, mensajeId: r.mensajeId, fechaCobro: r.fechaCobro.toISOString().slice(0, 10), importe: Number(r.total),
        fecha: movimiento.fechaValor, yaAplicado: r.estado === EstadoRemesa.COBRADA,
      };
    }),
    dudosos: casado.dudosos.map(({ movimiento, motivo }) => ({
      linea: movimiento.linea, fecha: movimiento.fechaValor, signo: movimiento.signo, importe: centimosAEuros(movimiento.centimos),
      texto: textoMovimiento(movimiento), motivo,
    })),
    /** Movimientos que no son de ninguna remesa: no se tocan. */
    ajenos: movimientos.filter((m) => !tocados.has(m)).length,
  };
}

export class Norma43Service {
  /** Qué haría el extracto, sin tocar nada. */
  static previa(contenido: string) {
    return analizar(contenido);
  }

  /**
   * Devuelve los recibos que el banco devolvió y da por cobradas las remesas
   * que abonó. Primero las devoluciones: una remesa dada por cobrada pasa a
   * pagado todo lo que siga en el banco, y un devuelto no debe entrar ahí.
   */
  static async aplicar(contenido: string, meta?: MetaDeAuditoria) {
    const analisis = await analizar(contenido);
    if (analisis.errores.length > 0) throw new HttpError(`El extracto no se puede aplicar: ${analisis.errores[0]}`);

    let devueltos = 0;
    let cobradas = 0;
    const omitidos: string[] = [];
    for (const d of analisis.devoluciones.filter((x) => !x.yaAplicado)) {
      try {
        // Con la fecha valor del movimiento: es el día en que el banco lo devolvió.
        await ReciboService.adminUpdateDetalles(d.reciboId, { estado: EstadoPago.DEVUELTO, fechaDevolucion: d.fecha }, meta, { delExtracto: true });
        devueltos += 1;
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        omitidos.push(`Recibo ${d.reciboId}: ${error.message}`);
      }
    }
    for (const c of analisis.cobros.filter((x) => !x.yaAplicado)) {
      try {
        await RemesaService.darPorCobrada(c.remesaId, meta, c.fecha);
        cobradas += 1;
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        omitidos.push(`${c.mensajeId}: ${error.message}`);
      }
    }

    await AuditoriaService.log(ACCIONES_AUDITORIA.NORMA43_APLICAR, meta ?? {}, 'extracto', analisis.cuentas.map((c) => c.cuenta).join(','), {
      despues: { cuentas: analisis.cuentas, devueltos, cobradas, dudosos: analisis.dudosos.length, omitidos: omitidos.length },
    });

    const partes: string[] = [];
    partes.push(devueltos === 1 ? '1 recibo marcado como devuelto' : `${devueltos} recibos marcados como devueltos`);
    partes.push(cobradas === 1 ? '1 remesa dada por cobrada' : `${cobradas} remesas dadas por cobradas`);
    return { message: `${partes.join(' y ')}.`, devueltos, cobradas, omitidos };
  }
}
