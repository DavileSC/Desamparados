import { manejar } from '../utils/manejar.js';
import { HttpError } from '../utils/error.handle.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { CensoHojaService } from '../services/censo-hoja.service.js';

const fichero = (file: Express.Multer.File | undefined) => {
  if (!file) throw new HttpError('Falta el fichero del censo.');
  return file.buffer;
};

export class CensoHojaController {
  static exportar = manejar('Error exportando el censo', async (req, res) => {
    const formato = req.query.formato === 'csv' ? 'csv' : 'xlsx';
    const { contenido, nombre, tipo } = await CensoHojaService.exportar(formato, req.query.bajas === 'si', AuditoriaService.metaFromReq(req));
    res.setHeader('Content-Type', tipo);
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    // Datos personales de todo el censo: que no se queden en ninguna caché.
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(contenido);
  });

  static previa = manejar('Error leyendo el fichero del censo', async (req, res) => {
    res.json(await CensoHojaService.previa(fichero(req.file)));
  });

  static importar = manejar('Error importando el censo', async (req, res) => {
    res.status(201).json(await CensoHojaService.importar(fichero(req.file), AuditoriaService.metaFromReq(req)));
  });
}
