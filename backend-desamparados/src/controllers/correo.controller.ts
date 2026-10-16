import { manejar } from '../utils/manejar.js';
import { handleHttp } from '../utils/error.handle.js';
import { claveDelAvisoValida, leerAvisos } from '../domain/avisos-de-envio.js';
import { RebotesService } from '../services/correos/rebotes.service.js';

export class CorreoController {
  static avisos = manejar('Error apuntando el aviso del servicio de envío', async (req, res) => {
    const secreto = process.env.CORREO_AVISOS_SECRETO?.trim();
    if (!secreto) {
      // Igual que una ruta que no existe: sin clave puesta, no hay nada aquí.
      handleHttp(res, null, 'Endpoint no encontrado', 404);
      return;
    }
    if (!claveDelAvisoValida(req.headers.authorization, secreto)) {
      res.status(401).json({ message: 'Falta la clave del aviso.' });
      return;
    }
    await RebotesService.registrar(leerAvisos(req.body));
    res.status(200).json({ ok: true });
  });
}
