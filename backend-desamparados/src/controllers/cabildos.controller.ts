import type { Request, Response } from 'express';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { CabildosService, type DatosCabildo, type DatosVotacion } from '../services/cabildos.service.js';

const id = (req: Request, clave = 'id') => Number(req.params[clave]);

/** «Libro de actas 2026» → libro-de-actas-2026.pdf */
function enviarPdf(res: Response, { pdf, titulo }: { pdf: Buffer; titulo: string }) {
  const nombre = titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
  // Nombres de hermanos y lo que se votó: que no se quede en ninguna caché.
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(pdf);
}

export class CabildosController {
  static listar = manejar('Error obteniendo los cabildos', async (_req, res) => { res.json(await CabildosService.listar()); });
  static obtener = manejar('Error obteniendo el cabildo', async (req, res) => { res.json(await CabildosService.obtener(id(req))); });
  static crear = manejar('Error convocando el cabildo', async (req, res) => { res.status(201).json(await CabildosService.crear(req.body as DatosCabildo)); });
  static actualizar = manejar('Error guardando el cabildo', async (req, res) => { res.json(await CabildosService.actualizar(id(req), req.body as DatosCabildo)); });
  static borrar = manejar('Error borrando el cabildo', async (req, res) => { await CabildosService.borrar(id(req)); res.status(204).end(); });
  static convocatoria = manejar('Error preparando la convocatoria', async (req, res) => {
    res.json(await CabildosService.prepararConvocatoria(id(req), AuditoriaService.metaFromReq(req)));
  });
  static anadirAsistente = manejar('Error apuntando la asistencia', async (req, res) => {
    res.json(await CabildosService.anadirAsistente(id(req), (req.body as { hermanoId: number }).hermanoId));
  });
  static quitarAsistente = manejar('Error quitando la asistencia', async (req, res) => { res.json(await CabildosService.quitarAsistente(id(req), id(req, 'hermanoId'))); });
  static anadirVotacion = manejar('Error apuntando la votación', async (req, res) => { res.json(await CabildosService.anadirVotacion(id(req), req.body as DatosVotacion)); });
  static borrarVotacion = manejar('Error borrando la votación', async (req, res) => { res.json(await CabildosService.borrarVotacion(id(req), id(req, 'votacionId'))); });
  static celebrar = manejar('Error dando el cabildo por celebrado', async (req, res) => {
    res.json(await CabildosService.darPorCelebrado(id(req), (req.body as { enSegunda?: boolean }).enSegunda === true, AuditoriaService.metaFromReq(req)));
  });
  static guardarActa = manejar('Error guardando el acta', async (req, res) => { res.json(await CabildosService.guardarActa(id(req), (req.body as { acta: string }).acta)); });
  static aprobarActa = manejar('Error aprobando el acta', async (req, res) => { res.json(await CabildosService.aprobarActa(id(req), AuditoriaService.metaFromReq(req))); });
  static actaPdf = manejar('Error generando el acta', async (req, res) => { enviarPdf(res, await CabildosService.actaPdf(id(req))); });
  static libro = manejar('Error generando el libro de actas', async (req, res) => { enviarPdf(res, await CabildosService.libroDeActas(Number(req.params.anio))); });
}
