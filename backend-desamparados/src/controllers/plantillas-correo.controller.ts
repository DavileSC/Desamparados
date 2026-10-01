import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { PlantillasCorreoService, type DatosPlantilla } from '../services/plantillas-correo.service.js';
import type { TextoDePlantilla } from '../domain/plantillas-correo.js';

const textoDe = (b: TextoDePlantilla) => ({ asunto: b.asunto, titulo: b.titulo, cuerpo: b.cuerpo, despedida: b.despedida });

export class PlantillasCorreoController {
  static listar = manejar('Error leyendo las plantillas de correo', async (_req, res) => {
    res.json(await PlantillasCorreoService.listar());
  });

  static obtener = manejar('Error leyendo la plantilla', async (req, res) => {
    res.json(await PlantillasCorreoService.obtener(Number(req.params.id)));
  });

  static crear = manejar('Error creando la plantilla', async (req, res) => {
    res.status(201).json(await PlantillasCorreoService.crear(req.body as DatosPlantilla, AuditoriaService.metaFromReq(req)));
  });

  static actualizar = manejar('Error guardando la plantilla', async (req, res) => {
    res.json(await PlantillasCorreoService.actualizar(Number(req.params.id), req.body as DatosPlantilla, AuditoriaService.metaFromReq(req)));
  });

  static borrar = manejar('Error borrando la plantilla', async (req, res) => {
    res.json(await PlantillasCorreoService.borrar(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });

  static usar = manejar('Error poniendo en uso la plantilla', async (req, res) => {
    const { uso, id } = req.body as { uso: string; id: number | null };
    res.json(await PlantillasCorreoService.usar(uso, id, AuditoriaService.metaFromReq(req)));
  });

  static vistaPrevia = manejar('Error preparando la vista previa', async (req, res) => {
    const b = req.body as TextoDePlantilla & { uso: string };
    res.json(PlantillasCorreoService.vistaPrevia(b.uso, textoDe(b)));
  });

  static prueba = manejar('Error mandando la prueba', async (req, res) => {
    const b = req.body as TextoDePlantilla & { uso: string };
    res.json(await PlantillasCorreoService.enviarPrueba(b.uso, textoDe(b), AuditoriaService.metaFromReq(req)));
  });

  static libres = manejar('Error leyendo las plantillas', async (_req, res) => {
    res.json(await PlantillasCorreoService.libres());
  });
}
