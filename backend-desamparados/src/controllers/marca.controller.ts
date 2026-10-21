import { MarcaService } from '../services/marca.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { HttpError } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';

export class MarcaController {
  static leer = manejar('Error leyendo la identidad y la marca', async (_req, res) => {
    res.status(200).json(MarcaService.estado());
  });

  static guardar = manejar('Error guardando la identidad y la marca', async (req, res) => {
    res.status(200).json(await MarcaService.guardar(req.body, AuditoriaService.metaFromReq(req)));
  });

  static subir = manejar('Error subiendo una imagen de la marca', async (req, res) => {
    if (!req.file) throw new HttpError('Falta la imagen.', 400);
    res.status(200).json(await MarcaService.subir(req.params.clave as never, req.file.buffer, AuditoriaService.metaFromReq(req)));
  });

  static quitar = manejar('Error quitando una imagen de la marca', async (req, res) => {
    res.status(200).json(await MarcaService.quitar(req.params.clave as never, AuditoriaService.metaFromReq(req)));
  });
}
