import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { PagoEnLineaService } from '../services/pagos/pago-en-linea.service.js';
import { DonativoService, type PeticionDeDonativo } from '../services/pagos/donativo.service.js';
import { pagoParaLaWeb } from '../domain/redsys.js';

export class PagoController {
  // A Redsys le basta un 200; un aviso que no es suyo recibe 400 y nada más.
  static avisoRedsys = manejar('Error procesando el aviso del banco', async (req, res) => {
    const valido = await PagoEnLineaService.avisoDelBanco(req.body as Record<string, unknown>, AuditoriaService.metaFromReq(req));
    res.status(valido ? 200 : 400).send(valido ? 'OK' : 'KO');
  });

  static metodos = manejar('Error leyendo el pago en línea', async (_req, res) => {
    res.json({ pago: pagoParaLaWeb() });
  });

  static donar = manejar('Error empezando el donativo', async (req, res) => {
    res.json(await DonativoService.iniciar(req.body as PeticionDeDonativo, AuditoriaService.metaFromReq(req)));
  });

  static estadoDelDonativo = manejar('Error consultando el donativo', async (req, res) => {
    res.json(await DonativoService.estado(String(req.params.pedido)));
  });
}
