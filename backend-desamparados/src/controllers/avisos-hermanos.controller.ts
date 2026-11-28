import { manejar } from '../utils/manejar';
import { AvisosPersonalesService } from '../services/avisos-personales.service.js';

/** La página Avisos del área: lo de la papeleta pendiente de la cuenta. */
export class AvisosHermanosController {
  static listarAvisos = manejar('No se han podido cargar tus avisos', async (req, res) => {
    res.status(200).json(await AvisosPersonalesService.listar(req.user!.id));
  });

  static obtenerAvisoPersonal = manejar('No se ha podido cargar el aviso', async (req, res) => {
    res.status(200).json(await AvisosPersonalesService.obtener(req.user!.id, Number(req.params.id)));
  });
}
