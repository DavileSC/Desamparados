import type { Role } from '@prisma/client';
import { PanelService } from '../services/panel.service.js';
import { AvisoService } from '../services/aviso.service.js';
import { RetabloService, type AjustesRetablo, type Retablo } from '../services/retablo.service.js';
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
      AvisoService.pendientes(req.user!.role as Role),
      RetabloService.deHoy(),
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

  // Los ajustes y, para elegir, las salidas y los actos que hay por delante.
  static leerRetablo = manejar('Error leyendo los ajustes del retablo', async (_req, res) => {
    const [ajustes, opciones] = await Promise.all([RetabloService.leer(), RetabloService.opciones()]);
    res.status(200).json({ ...ajustes, opciones });
  });

  static guardarRetablo = manejar('Error guardando los ajustes del retablo', async (req, res) => {
    // «Quitar foto» llega como cadena vacía: es volver a la de siempre. Lo que
    // no venga (los tiempos, la cuenta) se queda como estaba.
    const { foto, x, y, tiempos, cuenta } = req.body as Partial<AjustesRetablo> & Retablo;
    const antes = await RetabloService.leer();
    const ajustes = await RetabloService.guardar(
      { foto: foto || null, x, y, tiempos: tiempos ?? antes.tiempos, cuenta: cuenta ?? antes.cuenta },
      AuditoriaService.metaFromReq(req),
    );
    res.status(200).json({ ...ajustes, opciones: await RetabloService.opciones() });
  });
}
