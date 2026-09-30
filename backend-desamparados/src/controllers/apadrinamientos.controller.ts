import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { ApadrinamientosService, type DatosApadrinar, type DatosCampana, type DatosPieza } from '../services/apadrinamientos.service.js';

const n = (v: unknown) => Number(v);

export class ApadrinamientosController {
  static campanasPublicas = manejar('Error obteniendo los apadrinamientos', async (_req, res) => { res.json(await ApadrinamientosService.campanasPublicas()); });
  static campanaPublica = manejar('Error obteniendo la campaña', async (req, res) => { res.json(await ApadrinamientosService.campanaPublica(n(req.params.id))); });
  static apadrinar = manejar('Error apadrinando', async (req, res) => {
    res.status(201).json(await ApadrinamientosService.apadrinar(req.body as DatosApadrinar, AuditoriaService.metaFromReq(req)));
  });
  static apadrinamiento = manejar('Error obteniendo el apadrinamiento', async (req, res) => {
    res.json(await ApadrinamientosService.apadrinamientoPublico(String(req.params.token)));
  });

  static campanas = manejar('Error obteniendo las campañas', async (_req, res) => { res.json(await ApadrinamientosService.campanas()); });
  static campana = manejar('Error obteniendo la campaña', async (req, res) => { res.json(await ApadrinamientosService.campana(n(req.params.id))); });
  static crearCampana = manejar('Error guardando la campaña', async (req, res) => { res.status(201).json(await ApadrinamientosService.crearCampana(req.body as DatosCampana)); });
  static actualizarCampana = manejar('Error guardando la campaña', async (req, res) => { res.json(await ApadrinamientosService.actualizarCampana(n(req.params.id), req.body as DatosCampana)); });
  static ponerPieza = manejar('Error poniendo la pieza', async (req, res) => { res.json(await ApadrinamientosService.ponerPieza(n(req.params.id), req.body as DatosPieza)); });
  static cambiarPieza = manejar('Error cambiando la pieza', async (req, res) => {
    res.json(await ApadrinamientosService.cambiarPieza(n(req.params.id), n(req.params.piezaId), req.body as DatosPieza));
  });
  static quitarPieza = manejar('Error quitando la pieza', async (req, res) => { res.json(await ApadrinamientosService.quitarPieza(n(req.params.id), n(req.params.piezaId))); });
}
