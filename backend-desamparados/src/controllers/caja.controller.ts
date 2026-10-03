import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { CajaService } from '../services/caja.service.js';
import type { LineaDeCaja, MetodoDeCaja } from '../domain/caja.js';

export class CajaController {
  static estado = manejar('Error leyendo la caja', async (_req, res) => {
    res.json(await CajaService.estado());
  });

  static abrir = manejar('Error abriendo la caja', async (req, res) => {
    res.json(await CajaService.abrir((req.body as { fondoInicial: number }).fondoInicial, AuditoriaService.metaFromReq(req)));
  });

  static vender = manejar('Error cobrando la venta', async (req, res) => {
    const { lineas, metodo } = req.body as { lineas: { productoId?: number; tallaId?: number; nombre?: string; centimos?: number; cantidad: number }[]; metodo: MetodoDeCaja };
    const deCaja: LineaDeCaja[] = lineas.map((l) => (l.productoId !== undefined
      ? { productoId: l.productoId, ...(l.tallaId !== undefined ? { tallaId: l.tallaId } : {}), cantidad: l.cantidad }
      : { nombre: l.nombre!, centimos: l.centimos!, cantidad: l.cantidad }));
    res.json(await CajaService.vender(deCaja, metodo, AuditoriaService.metaFromReq(req)));
  });

  static anular = manejar('Error anulando la venta', async (req, res) => {
    res.json(await CajaService.anular(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });

  static cerrar = manejar('Error cerrando la caja', async (req, res) => {
    const { efectivoContado, observaciones } = req.body as { efectivoContado: number; observaciones?: string | null };
    res.json(await CajaService.cerrar(efectivoContado, observaciones ?? null, AuditoriaService.metaFromReq(req)));
  });
}
