import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { CortejoService } from '../services/procesion/cortejo.service.js';
import { salidaDe } from '../services/procesion/salidas.service.js';
import type { ConfiguracionCortejo } from '../domain/cortejo.js';

export class CortejoController {
  static estado = manejar('Error leyendo el cortejo', async (req, res) => {
    const salida = await salidaDe(req);
    res.json(await CortejoService.estado(salida, req.query.year ? Number(req.query.year) : undefined));
  });

  static guardarConfiguracion = manejar('Error guardando los tramos del cortejo', async (req, res) => {
    const { salida: _slug, ...config } = req.body as ConfiguracionCortejo & { salida: string };
    res.json(await CortejoService.guardarConfiguracion(await salidaDe(req), config, AuditoriaService.metaFromReq(req)));
  });

  static aplicar = manejar('Error repartiendo el cortejo', async (req, res) => {
    const { year } = req.body as { year: number };
    res.json(await CortejoService.aplicar(await salidaDe(req), year, AuditoriaService.metaFromReq(req)));
  });
}
