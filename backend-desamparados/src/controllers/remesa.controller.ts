import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { RemesaService, type FiltroRemesa } from '../services/remesa.service.js';

export class RemesaController {
  static estado = manejar('Error obteniendo las remesas', async (_req, res) => {
    res.json(await RemesaService.estado());
  });

  static previa = manejar('Error preparando la remesa', async (req, res) => {
    res.json(await RemesaService.previa(req.body as FiltroRemesa));
  });

  static generar = manejar('Error generando la remesa', async (req, res) => {
    res.status(201).json(await RemesaService.generar(req.body as FiltroRemesa, AuditoriaService.metaFromReq(req)));
  });

  static fichero = manejar('Error descargando la remesa', async (req, res) => {
    const { nombre, xml } = await RemesaService.fichero(Number(req.params.id));
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    // Lleva las cuentas de los hermanos: que no se quede en ninguna caché.
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(xml);
  });

  static darPorCobrada = manejar('Error dando la remesa por cobrada', async (req, res) => {
    res.json(await RemesaService.darPorCobrada(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });
}
