import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { PuertaService } from '../services/procesion/puerta.service.js';
import { salidaDe } from '../services/procesion/salidas.service.js';

export class PuertaController {
  static estado = manejar('Error leyendo la puerta del templo', async (req, res) => {
    // Se pregunta cada pocos segundos desde varios móviles: nada de copias viejas por el camino.
    res.set('Cache-Control', 'no-store');
    res.json(await PuertaService.estado(await salidaDe(req)));
  });

  static escanear = manejar('Error leyendo la papeleta', async (req, res) => {
    const { codigo } = req.body as { codigo: string };
    res.json(await PuertaService.escanear(codigo, await salidaDe(req), AuditoriaService.metaFromReq(req)));
  });

  static entrar = manejar('Error apuntando la entrada', async (req, res) => {
    res.json(await PuertaService.entrar(Number(req.params.id), await salidaDe(req), AuditoriaService.metaFromReq(req)));
  });

  static deshacer = manejar('Error deshaciendo la entrada', async (req, res) => {
    res.json(await PuertaService.deshacer(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });
}
