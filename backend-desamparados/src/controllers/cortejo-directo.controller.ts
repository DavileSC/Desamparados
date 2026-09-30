import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { CortejoDirectoService, type PosicionEnviada } from '../services/cortejo-directo.service.js';

export class CortejoDirectoController {
  static publico = manejar('Error obteniendo la posición del cortejo', async (_req, res) => {
    // El mapa pregunta cada pocos segundos: que ningún intermediario guarde una posición vieja.
    res.set('Cache-Control', 'no-store');
    res.json(await CortejoDirectoService.publico());
  });
  static paraLaJunta = manejar('Error obteniendo la posición del cortejo', async (_req, res) => { res.json(await CortejoDirectoService.paraLaJunta()); });
  static enviar = manejar('Error guardando la posición del cortejo', async (req, res) => {
    res.json(await CortejoDirectoService.enviar(req.body as PosicionEnviada, AuditoriaService.metaFromReq(req)));
  });
  static terminar = manejar('Error terminando el directo', async (req, res) => { res.json(await CortejoDirectoService.terminar(AuditoriaService.metaFromReq(req))); });
}
