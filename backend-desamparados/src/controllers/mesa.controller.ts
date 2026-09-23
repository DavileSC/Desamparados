import { MesaService, type AltaEnMesaDto, type CorreccionFichaDto, type EdicionPapeletaDto } from '../services/procesion/mesa.service.js';
import type { TipoRopa } from '../services/procesion/ropa.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';
import { HttpError } from '../utils/error.handle.js';

/** La mesa de la procesión (ver `MesaService`). Apuntar y cobrar va por `/admin/inscribir`. */
export class MesaController {
  static buscar = manejar('Error buscando en el censo', async (req, res) => {
    res.json(await MesaService.buscarPersonas(String(req.query.q ?? '')));
  });

  static esperados = manejar('Error leyendo quién viene hoy', async (_req, res) => {
    res.json(await MesaService.esperadosHoy());
  });

  static ficha = manejar('Error leyendo la ficha para la mesa', async (req, res) => {
    res.json(await MesaService.ficha(Number(req.params.id)));
  });

  static prendas = manejar('Error buscando en el ropero', async (req, res) => {
    res.json(await MesaService.prendas(req.query.tipo as TipoRopa, String(req.query.q ?? '')));
  });

  static alta = manejar('Error dando de alta en la mesa', async (req, res) => {
    const { tutorHermanoId, tutorNuevo, ...persona } = req.body as Omit<AltaEnMesaDto, 'tutor'> & {
      tutorHermanoId?: number; tutorNuevo?: Extract<AltaEnMesaDto['tutor'], { nuevo: unknown }>['nuevo'];
    };
    if (tutorHermanoId && tutorNuevo) throw new HttpError('Elige un tutor: el del censo o uno nuevo, no los dos.');
    const tutor = tutorHermanoId ? { hermanoId: tutorHermanoId } : tutorNuevo ? { nuevo: tutorNuevo } : undefined;
    res.status(201).json(await MesaService.darDeAlta({ ...persona, tutor }, AuditoriaService.metaFromReq(req)));
  });

  static corregir = manejar('Error corrigiendo la ficha', async (req, res) => {
    res.json(await MesaService.corregirFicha(Number(req.params.id), req.body as CorreccionFichaDto, AuditoriaService.metaFromReq(req)));
  });

  static activar = manejar('Error poniendo en activo', async (req, res) => {
    res.json(await MesaService.activar(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });

  static editarPapeleta = manejar('Error corrigiendo la papeleta', async (req, res) => {
    res.json(await MesaService.editarPapeleta(Number(req.params.id), req.body as EdicionPapeletaDto, AuditoriaService.metaFromReq(req)));
  });

  static listado = manejar('Error leyendo los apuntados', async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    res.json(await MesaService.listado(year, { q: req.query.q as string | undefined, puesto: req.query.puesto as string | undefined }));
  });
}
