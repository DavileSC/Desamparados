import type { Salida } from '@prisma/client';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { PuertaService } from '../services/procesion/puerta.service.js';

export class PuertaController {
  static estado = manejar('Error leyendo la puerta del templo', async (req, res) => {
    // Se pregunta cada pocos segundos desde varios móviles: nada de copias viejas por el camino.
    res.set('Cache-Control', 'no-store');
    res.json(await PuertaService.estado((req.query.salida as Salida | undefined) ?? 'PASION'));
  });

  static escanear = manejar('Error leyendo la papeleta', async (req, res) => {
    const { codigo, salida } = req.body as { codigo: string; salida: Salida };
    res.json(await PuertaService.escanear(codigo, salida, AuditoriaService.metaFromReq(req)));
  });

  static entrar = manejar('Error apuntando la entrada', async (req, res) => {
    const { salida } = req.body as { salida: Salida };
    res.json(await PuertaService.entrar(Number(req.params.id), salida, AuditoriaService.metaFromReq(req)));
  });

  static deshacer = manejar('Error deshaciendo la entrada', async (req, res) => {
    res.json(await PuertaService.deshacer(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });
}
