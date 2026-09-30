import type { Salida } from '@prisma/client';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { CortejoService } from '../services/procesion/cortejo.service.js';
import type { ConfiguracionCortejo } from '../domain/cortejo.js';

export class CortejoController {
  static estado = manejar('Error leyendo el cortejo', async (req, res) => {
    const salida = (req.query.salida as Salida | undefined) ?? 'PASION';
    res.json(await CortejoService.estado(salida, req.query.year ? Number(req.query.year) : undefined));
  });

  static guardarConfiguracion = manejar('Error guardando los tramos del cortejo', async (req, res) => {
    const { salida, ...config } = req.body as ConfiguracionCortejo & { salida: Salida };
    res.json(await CortejoService.guardarConfiguracion(salida, config, AuditoriaService.metaFromReq(req)));
  });

  static aplicar = manejar('Error repartiendo el cortejo', async (req, res) => {
    const { salida, year } = req.body as { salida: Salida; year: number };
    res.json(await CortejoService.aplicar(salida, year, AuditoriaService.metaFromReq(req)));
  });
}
