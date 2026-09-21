import { Response, Request } from 'express';
import { ReciboService, type ConsultaRecibos } from '../services/recibo.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { EstadoPago } from '@prisma/client';

export class ReciboController {

  // =================================================================
  //  ZONA FAMILIA (App del Hermano)
  // =================================================================

  static getMyRecibos = manejar('Error obteniendo tus recibos', async (req, res) => {
    const userId = req.user!.id;
    const recibosFamiliares = await ReciboService.getRecibosByUsuarioFamilia(userId, req.query);
    res.status(200).json(recibosFamiliares);
  });

  static getMyRecibo = manejar('Error obteniendo el recibo', async (req, res) => {
    const userId = req.user!.id;
    const recibo = await ReciboService.getReciboFamiliar(userId, Number(req.params.id));
    res.status(200).json(recibo);
  });

  // =================================================================
  //  ZONA ADMIN / TESORERÍA
  // =================================================================

  static getAdminRecibos = manejar('Error obteniendo recibos administrativos', async (req, res) => {
    // `adminRecibosQuerySchema` ya garantiza que, si vienen, `year` son
    // cuatro cifras y `estado` uno de los del enum (nunca una lista).
    const query = req.query as ConsultaRecibos & { year?: string; estado?: EstadoPago };
    const year = query.year ? Number(query.year) : undefined;
    const result = await ReciboService.getAdminRecibos(query, year, query.estado);
    res.status(200).json(result);
  });

  static getResumenAdmin = manejar('Error obteniendo el resumen de recibos', async (req, res) => {
    const query = req.query as ConsultaRecibos & { year?: string };
    const year = query.year ? Number(query.year) : undefined;
    res.status(200).json(await ReciboService.getResumenAdmin(query, year));
  });

  static buscarHermanos = manejar('Error buscando hermanos', async (req, res) => {
    const hermanos = await ReciboService.buscarHermanos(String(req.query.q));
    res.status(200).json(hermanos);
  });

  static emitir = manejar('Error emitiendo el recibo', async (req, res) => {
    const recibo = await ReciboService.emitirRecibo(req.body, AuditoriaService.metaFromReq(req));
    res.status(201).json({
      message: `Recibo «${recibo.concepto}» emitido.`,
      reciboId: recibo.id,
      estado: recibo.estado
    });
  });

  static generarCuotas = manejar('Error generando cuotas masivas', async (req, res) => {
    // req.body validado por ArkType
    const result = await ReciboService.generarCuotaAnual(req.body, AuditoriaService.metaFromReq(req));

    // --- ACTUALIZADO: El servicio ahora nos devuelve un mensaje exacto y los omitidos ---
    res.status(201).json({
      message: result.message,
      omitidos: result.omitidos
    });
  });

  static marcarPagado = manejar('Error al cobrar el recibo', async (req, res) => {
    const id = Number(req.params.id);

    const recibo = await ReciboService.adminMarcarComoPagado(id, req.body?.metodoPago, AuditoriaService.metaFromReq(req));

    res.status(200).json({
      message: 'Recibo cobrado correctamente. Si tenía papeleta, se ha enviado por email.',
      reciboId: recibo.id,
      estado: recibo.estado
    });
  });

  static updateDetalles = manejar('Error actualizando recibo', async (req, res) => {
    const id = Number(req.params.id);
    const reciboActualizado = await ReciboService.adminUpdateDetalles(id, req.body, AuditoriaService.metaFromReq(req));
    res.status(200).json(reciboActualizado);
  });
}
