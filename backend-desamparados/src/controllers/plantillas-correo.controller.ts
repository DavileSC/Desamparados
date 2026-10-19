import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { PlantillasCorreoService, type DatosPlantilla } from '../services/plantillas-correo.service.js';
import type { PlantillaDeCorreo } from '../domain/plantillas-correo.js';
import { FICHEROS_MARCA } from '../domain/marca.js';
import { NotFoundError } from '../utils/error.handle.js';

const plantillaDe = (b: PlantillaDeCorreo) => ({ asunto: b.asunto, resumen: b.resumen, titulo: b.titulo, contenido: b.contenido, despedida: b.despedida });

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

  static versiones = manejar('Error leyendo las versiones de la plantilla', async (req, res) => {
    res.json(await PlantillasCorreoService.versiones(Number(req.params.id)));
  });

  static borrar = manejar('Error borrando la plantilla', async (req, res) => {
    res.json(await PlantillasCorreoService.borrar(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });

  static usar = manejar('Error poniendo en uso la plantilla', async (req, res) => {
    const { uso, id } = req.body as { uso: string; id: number | null };
    res.json(await PlantillasCorreoService.usar(uso, id, AuditoriaService.metaFromReq(req)));
  });

  static vistaPrevia = manejar('Error preparando la vista previa', async (req, res) => {
    const b = req.body as PlantillaDeCorreo & { uso: string };
    res.json(PlantillasCorreoService.vistaPrevia(b.uso, plantillaDe(b)));
  });

  static prueba = manejar('Error mandando la prueba', async (req, res) => {
    const b = req.body as PlantillaDeCorreo & { uso: string };
    res.json(await PlantillasCorreoService.enviarPrueba(b.uso, plantillaDe(b), AuditoriaService.metaFromReq(req)));
  });

  /**
   * El escudo del membrete y la cabecera de los correos, para que el editor
   * pinte la carta como llega. La web solo publica el escudo para fondo
   * oscuro (el de la barra); el de los correos va sobre blanco.
   */
  static marca = manejar('Error leyendo la imagen del membrete', async (req, res) => {
    const fichero = req.params.pieza === 'escudo' ? FICHEROS_MARCA.escudoSobreClaro : req.params.pieza === 'cabecera' ? FICHEROS_MARCA.correoCabecera : null;
    if (!fichero) throw new NotFoundError('Esa imagen no está en la marca.');
    res.type(fichero.tipo).set('Cache-Control', 'private, max-age=3600').sendFile(fichero.ruta);
  });

  static libres = manejar('Error leyendo las plantillas', async (_req, res) => {
    res.json(await PlantillasCorreoService.libres());
  });
}
