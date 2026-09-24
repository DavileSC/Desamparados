import type { Request, Response } from 'express';
import type { Salida } from '@prisma/client';
import { MesaService, type AltaEnMesaDto, type CorreccionFichaDto, type EdicionPapeletaDto, type EdicionSolicitudDto, type ZonaDeBusqueda } from '../services/procesion/mesa.service.js';
import { PapeletasService } from '../services/procesion/papeletas.service.js';
import { ZonasService, type CobroEnMesa, type EntregaEnMesa, type InscripcionEnMesa } from '../services/procesion/zonas.service.js';
import { escucharLaMesa } from '../services/procesion/avisos-mesa.js';
import type { TipoRopa } from '../services/procesion/ropa.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';
import { HttpError } from '../utils/error.handle.js';

const salidaDe = (req: Request) => (req.query.salida as Salida | undefined) ?? 'PASION';
/** La clave de la operación va en el cuerpo; el resto es el DTO. */
const sinClave = <T extends { clave?: string }>(cuerpo: T) => {
  const { clave, ...dto } = cuerpo;
  return { clave, dto };
};

/** Cada cuánto se manda un latido por el canal: los proxies cortan las conexiones calladas. */
const LATIDO_MS = 25_000;

/** La mesa de la procesión (ver `MesaService` y `ZonasService`). */
export class MesaController {
  static buscar = manejar('Error buscando en el censo', async (req, res) => {
    res.json(await MesaService.buscarPersonas(String(req.query.q ?? ''), {
      zona: req.query.zona as ZonaDeBusqueda | undefined,
      salida: salidaDe(req),
    }));
  });

  static esperados = manejar('Error leyendo quién viene hoy', async (req, res) => {
    res.json(await MesaService.esperadosHoy(salidaDe(req)));
  });

  static ficha = manejar('Error leyendo la ficha para la mesa', async (req, res) => {
    res.json(await MesaService.ficha(Number(req.params.id), salidaDe(req)));
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

  static editarSolicitud = manejar('Error corrigiendo la solicitud', async (req, res) => {
    res.json(await MesaService.editarSolicitud(Number(req.params.id), req.body as EdicionSolicitudDto, AuditoriaService.metaFromReq(req)));
  });

  static cancelarSolicitud = manejar('Error cancelando la solicitud', async (req, res) => {
    res.json(await PapeletasService.cancelarSolicitud(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });

  static listado = manejar('Error leyendo los apuntados', async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    res.json(await MesaService.listado(year, {
      q: req.query.q as string | undefined,
      puesto: req.query.puesto as string | undefined,
      salida: salidaDe(req),
    }));
  });

  // --- Las zonas ---

  static inscribir = manejar('Error apuntando en la mesa', async (req, res) => {
    const { clave, dto } = sinClave(req.body as InscripcionEnMesa & { clave?: string });
    res.status(201).json(await ZonasService.inscribir(dto, clave, AuditoriaService.metaFromReq(req)));
  });

  static cobrar = manejar('Error cobrando en la mesa', async (req, res) => {
    const { clave, dto } = sinClave(req.body as CobroEnMesa & { clave?: string });
    res.json(await ZonasService.cobrar(dto, clave, AuditoriaService.metaFromReq(req)));
  });

  static perdonar = manejar('Error perdonando la cuota', async (req, res) => {
    const { clave, dto } = sinClave(req.body as { reciboIds: number[]; motivo?: string; clave?: string });
    res.json(await ZonasService.perdonar(dto, clave, AuditoriaService.metaFromReq(req)));
  });

  static entregar = manejar('Error dando la ropa', async (req, res) => {
    const { clave, dto } = sinClave(req.body as EntregaEnMesa & { clave?: string });
    res.json(await ZonasService.entregar(dto, clave, AuditoriaService.metaFromReq(req)));
  });

  static colas = manejar('Error leyendo las colas de la mesa', async (req, res) => {
    res.json(await ZonasService.colas(salidaDe(req)));
  });

  static preparacion = manejar('Error leyendo la ropa por preparar', async (req, res) => {
    res.json(await ZonasService.preparacion(req.query.turnoId ? Number(req.query.turnoId) : undefined));
  });

  /**
   * El canal por el que cada ordenador de la mesa se entera de lo que hacen
   * los otros (eventos del servidor). El navegador reconecta solo si se
   * corta; al reconectar, la mesa vuelve a leer lo que tiene en pantalla.
   */
  static eventos = (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Que un nginx por delante no lo retenga en su búfer.
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    const dejar = escucharLaMesa((aviso) => res.write(`data: ${JSON.stringify(aviso)}\n\n`));
    const latido = setInterval(() => res.write(': latido\n\n'), LATIDO_MS);
    req.on('close', () => { clearInterval(latido); dejar(); });
  };
}
