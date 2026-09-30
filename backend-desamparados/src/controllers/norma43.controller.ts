import { manejar } from '../utils/manejar.js';
import { HttpError } from '../utils/error.handle.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { Norma43Service } from '../services/norma43.service.js';
import { textoDeFichero } from '../middleware/upload.middleware.js';

const contenido = (file: Express.Multer.File | undefined) => {
  if (!file) throw new HttpError('Falta el fichero del extracto.');
  return textoDeFichero(file.buffer);
};

export class Norma43Controller {
  static previa = manejar('Error leyendo el extracto', async (req, res) => {
    res.json(await Norma43Service.previa(contenido(req.file)));
  });

  static aplicar = manejar('Error aplicando el extracto', async (req, res) => {
    res.json(await Norma43Service.aplicar(contenido(req.file), AuditoriaService.metaFromReq(req)));
  });
}
