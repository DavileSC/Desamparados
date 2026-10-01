import type { MetodoPago } from '@prisma/client';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { LoteriaService, type DatosSorteo, type Entrega } from '../services/loteria/loteria.service.js';

const id = (req: { params: Record<string, unknown> }) => Number(req.params.id);

export class LoteriaController {
  static sorteos = manejar('Error leyendo los sorteos', async (_req, res) => { res.json(await LoteriaService.sorteos()); });
  static sorteo = manejar('Error leyendo el sorteo', async (req, res) => { res.json(await LoteriaService.sorteo(id(req))); });
  static crear = manejar('Error guardando el sorteo', async (req, res) => { res.status(201).json(await LoteriaService.crear(req.body as DatosSorteo)); });
  static actualizar = manejar('Error guardando el sorteo', async (req, res) => { res.json(await LoteriaService.actualizar(id(req), req.body as DatosSorteo)); });
  static borrar = manejar('Error borrando el sorteo', async (req, res) => { res.json(await LoteriaService.borrar(id(req))); });
  static premios = manejar('Error guardando los premios', async (req, res) => {
    res.json(await LoteriaService.premios(id(req), (req.body as { premios: (number | null)[] }).premios, AuditoriaService.metaFromReq(req)));
  });

  static apuntarCompra = manejar('Error apuntando la compra', async (req, res) => {
    res.json(await LoteriaService.apuntarCompra(id(req), (req.body as { metodoPago: MetodoPago }).metodoPago, AuditoriaService.metaFromReq(req)));
  });
  static deshacerCompra = manejar('Error deshaciendo la compra', async (req, res) => { res.json(await LoteriaService.deshacerCompra(id(req), AuditoriaService.metaFromReq(req))); });

  static crearTalonarios = manejar('Error creando los talonarios', async (req, res) => {
    res.json(await LoteriaService.crearTalonarios(id(req), (req.body as { cantidad: number }).cantidad));
  });
  static entregar = manejar('Error entregando los talonarios', async (req, res) => {
    res.json(await LoteriaService.entregar(id(req), req.body as Entrega, AuditoriaService.metaFromReq(req)));
  });
  static borrarTalonario = manejar('Error quitando el talonario', async (req, res) => { res.json(await LoteriaService.borrarTalonario(id(req))); });
  static liquidar = manejar('Error liquidando el talonario', async (req, res) => {
    const { vendidas, metodoPago } = req.body as { vendidas: number; metodoPago: MetodoPago | null };
    res.json(await LoteriaService.liquidar(id(req), vendidas, metodoPago, AuditoriaService.metaFromReq(req)));
  });
  static deshacerLiquidacion = manejar('Error deshaciendo la liquidación', async (req, res) => {
    res.json(await LoteriaService.deshacerLiquidacion(id(req), AuditoriaService.metaFromReq(req)));
  });

  static pdf = manejar('Error generando las participaciones', async (req, res) => {
    const { desde, hasta } = req.body as { desde: number; hasta: number };
    const pdf = await LoteriaService.pdf(id(req), desde, hasta);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="participaciones-${desde}-${hasta}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(pdf);
  });
}
