import { PanelService } from '../services/panel.service.js';
import { AvisoService } from '../services/aviso.service.js';
import { RetabloService } from '../services/retablo.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class PanelController {
  // Las cifras de conjunto (PanelService, que no toca datos de personas) y,
  // al lado, lo que la junta gestiona a mano: sus avisos y la foto del retablo.
  static get = manejar('Error obteniendo el panel', async (req, res) => {
    // El año inválido llega como HttpError desde el dominio y handleHttp lo
    // convierte en 400: es un parámetro mal puesto, no un fallo del servidor.
    const [panel, avisos, retablo] = await Promise.all([
      PanelService.getPanel(req.query.anio),
      AvisoService.pendientes(),
      RetabloService.leer(),
    ]);
    res.status(200).json({ ...panel, avisos, retablo });
  });

  static crearAviso = manejar('Error creando el aviso', async (req, res) => {
    const aviso = await AvisoService.crear(req.body, req.user!, AuditoriaService.metaFromReq(req));
    res.status(201).json(aviso);
  });

  static avisoHecho = manejar('Error dando el aviso por hecho', async (req, res) => {
    await AvisoService.hecho(Number(req.params.id), req.user!, AuditoriaService.metaFromReq(req));
    res.status(204).end();
  });

  static leerRetablo = manejar('Error leyendo la foto del retablo', async (_req, res) => {
    res.status(200).json(await RetabloService.leer());
  });

  static guardarRetablo = manejar('Error guardando la foto del retablo', async (req, res) => {
    // «Quitar foto» llega como cadena vacía: es volver a la de siempre.
    const { foto, x, y } = req.body as { foto: string | null; x: number; y: number };
    res.status(200).json(await RetabloService.guardar({ foto: foto || null, x, y }, AuditoriaService.metaFromReq(req)));
  });
}
