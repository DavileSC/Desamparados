import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { CajaService } from '../services/caja.service.js';
import type { LineaDeCaja, MetodoDeCaja } from '../domain/caja.js';

export class CajaController {
  static estado = manejar('Error leyendo la caja', async (_req, res) => {
    res.json(await CajaService.estado());
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

  static ingresar = manejar('Error apuntando el ingreso en el banco', async (req, res) => {
    const { fecha, importe, nota } = req.body as { fecha: string; importe: number; nota?: string | null };
    res.json(await CajaService.ingresar(fecha, importe, nota ?? null, AuditoriaService.metaFromReq(req)));
  });

  static borrarIngreso = manejar('Error borrando el ingreso en el banco', async (req, res) => {
    res.json(await CajaService.borrarIngreso(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });
}
