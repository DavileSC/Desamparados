import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { PagoEnLineaService } from '../services/pagos/pago-en-linea.service.js';

export class PagoController {
  // A Redsys le basta un 200; un aviso que no es suyo recibe 400 y nada más.
  static avisoRedsys = manejar('Error procesando el aviso del banco', async (req, res) => {
    const valido = await PagoEnLineaService.avisoDelBanco(req.body as Record<string, unknown>, AuditoriaService.metaFromReq(req));
    res.status(valido ? 200 : 400).send(valido ? 'OK' : 'KO');
  });
}
