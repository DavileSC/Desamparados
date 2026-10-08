import type { Request, Response } from 'express';
import { esDelCensoEnMesa, MesaService, type AccesoMesa, type AltaEnMesaDto, type CorreccionFichaDto, type EdicionPapeletaDto, type EdicionSolicitudDto, type ZonaDeBusqueda } from '../services/procesion/mesa.service.js';
import { PapeletasService } from '../services/procesion/papeletas.service.js';
import { anioDeLaMesa, ZonasService, type CobroEnMesa, type DevolucionEnMesa, type EntregaEnMesa, type InscripcionEnMesa } from '../services/procesion/zonas.service.js';
import { recuentoDeCingulos } from '../services/procesion/cingulos.js';
import { escucharLaMesa } from '../services/procesion/avisos-mesa.js';
import type { TipoRopa } from '../services/procesion/ropa.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { archivoDePapeleta, datosDeLaPapeleta, papeletaEnPdf } from '../services/procesion/papeleta-pdf.js';
import { salidaDe } from '../services/procesion/salidas.service.js';

/** La clave de la operación va en el cuerpo; el resto es el DTO. */
const sinClave = <T extends { clave?: string }>(cuerpo: T) => {
  const { clave, ...dto } = cuerpo;
  return { clave, dto };
};

/** Cada cuánto se manda un latido por el canal: los proxies cortan las conexiones calladas. */
const LATIDO_MS = 25_000;

/** Lo que ve y corrige quien pide: el censo entero, o solo lo que hace falta para cobrar y dar la ropa. */
const accesoDe = (req: Request): AccesoMesa => ({ censo: esDelCensoEnMesa(req.user?.role) });

/** La mesa de la procesión (ver `MesaService` y `ZonasService`). */
export class MesaController {
  static buscar = manejar('Error buscando en el censo', async (req, res) => {
    res.json(await MesaService.buscarPersonas(String(req.query.q ?? ''), await salidaDe(req), {
      zona: req.query.zona as ZonaDeBusqueda | undefined,
      acceso: accesoDe(req),
    }));
  });

  static esperados = manejar('Error leyendo quién viene hoy', async (req, res) => {
    res.json(await MesaService.esperadosHoy(await salidaDe(req)));
  });

  static ficha = manejar('Error leyendo la ficha para la mesa', async (req, res) => {
    res.json(await MesaService.ficha(Number(req.params.id), await salidaDe(req), accesoDe(req)));
  });

  static prendas = manejar('Error buscando en el ropero', async (req, res) => {
    res.json(await MesaService.prendas(req.query.tipo as TipoRopa, String(req.query.q ?? ''), await salidaDe(req)));
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
    res.json(await MesaService.corregirFicha(Number(req.params.id), req.body as CorreccionFichaDto, AuditoriaService.metaFromReq(req), accesoDe(req)));
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

  static papeletaPdf = manejar('Error generando la papeleta', async (req, res) => {
    const datos = await datosDeLaPapeleta(Number(req.params.id));
    if (!datos) throw new NotFoundError('No se encontró esa papeleta.');
    const pdf = await papeletaEnPdf(datos);
    res.setHeader('Content-Type', 'application/pdf');
    // En línea: la mesa la abre en otra pestaña para imprimirla.
    res.setHeader('Content-Disposition', `inline; filename="${archivoDePapeleta(datos)}"`);
    // Lleva datos de una persona: que no se quede en ninguna caché compartida.
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(pdf);
  });

  static listado = manejar('Error leyendo los apuntados', async (req, res) => {
    // Sin año, el de la salida que se está repartiendo, no el natural (ver `anioDeLaMesa`).
    const salida = await salidaDe(req);
    const year = req.query.year ? Number(req.query.year) : anioDeLaMesa(salida);
    res.json(await MesaService.listado(year, salida, {
      q: req.query.q as string | undefined,
      puesto: req.query.puesto as string | undefined,
      faltaCingulo: req.query.faltaCingulo === '1',
    }, accesoDe(req)));
  });

  // --- Las zonas ---

  static inscribir = manejar('Error apuntando en la mesa', async (req, res) => {
    const { clave, dto } = sinClave(req.body as Omit<InscripcionEnMesa, 'salida'> & { salida: string; clave?: string });
    const salida = await salidaDe(req);
    res.status(201).json(await ZonasService.inscribir({ ...dto, salida }, clave, AuditoriaService.metaFromReq(req)));
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

  static devolver = manejar('Error recibiendo la devolución', async (req, res) => {
    const { clave, dto } = sinClave(req.body as DevolucionEnMesa & { clave?: string });
    res.json(await ZonasService.devolver(dto, clave, AuditoriaService.metaFromReq(req)));
  });

  static sinDevolver = manejar('Error leyendo quién no ha devuelto la ropa', async (_req, res) => {
    res.json(await ZonasService.sinDevolver());
  });

  static cingulos = manejar('Error contando los cíngulos', async (_req, res) => {
    res.json(await recuentoDeCingulos());
  });

  static colas = manejar('Error leyendo las colas de la mesa', async (req, res) => {
    res.json(await ZonasService.colas(await salidaDe(req)));
  });

  static preparacion = manejar('Error leyendo la ropa por preparar', async (req, res) => {
    res.json(await ZonasService.preparacion(await salidaDe(req), req.query.turnoId ? Number(req.query.turnoId) : undefined));
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
