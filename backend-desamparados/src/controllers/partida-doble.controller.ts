import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { PartidaDobleService } from '../services/partida-doble.service.js';

export class PartidaDobleController {
  static plan = manejar('Error obteniendo el plan de cuentas', async (_req, res) => { res.json(await PartidaDobleService.plan()); });

  static asignarCuenta = manejar('Error cambiando la cuenta de la categoría', async (req, res) => {
    res.json(await PartidaDobleService.asignarCuenta(Number(req.params.id), (req.body as { cuenta: string | null }).cuenta, AuditoriaService.metaFromReq(req)));
  });

  static ejercicio = manejar('Error obteniendo el ejercicio', async (req, res) => { res.json(await PartidaDobleService.ejercicio(Number(req.params.anio))); });

  static diario = manejar('Error obteniendo el libro diario', async (req, res) => {
    res.json(await PartidaDobleService.diario(Number(req.params.anio), Number(req.query.pagina ?? 1) || 1, Number(req.query.porPagina ?? 50)));
  });

  static excel = manejar('Error exportando la contabilidad', async (req, res) => {
    const { contenido, nombre } = await PartidaDobleService.excel(Number(req.params.anio), AuditoriaService.metaFromReq(req));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(contenido);
  });
}
