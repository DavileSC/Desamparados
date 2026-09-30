import type { Response } from 'express';
import { DatosService } from '../services/datos.service.js';
import { MemoriaService, leerCurso } from '../services/memoria.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { informeDeArea, memoriaDelCurso } from '../services/informes/informes.js';
import { leerPeriodo, periodoDe } from '../domain/periodo-datos.js';
import { areasDe, type ClaveArea } from '../domain/datos-areas.js';
import { HttpError } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';

/** «Informe de hermanos · Curso 2025–2026» → informe-de-hermanos-curso-2025-2026.pdf */
const nombreDeArchivo = (texto: string) =>
  `${texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;

function enviarPdf(res: Response, pdf: Buffer, titulo: string, enLinea = false) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${enLinea ? 'inline' : 'attachment'}; filename="${nombreDeArchivo(titulo)}"`);
  // Son cifras de la junta: que no se queden en ninguna caché compartida.
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(pdf);
}

export class DatosController {
  static leer = manejar('Error obteniendo los datos', async (req, res) => {
    const hoy = new Date();
    res.status(200).json(await DatosService.leer(leerPeriodo(req.query.periodo, hoy), hoy));
  });

  static informe = manejar('Error generando el informe', async (req, res) => {
    const hoy = new Date();
    const periodo = leerPeriodo(req.query.periodo, hoy);
    const crudos = await DatosService.crudos(periodo, hoy);
    const area = areasDe(crudos, periodo, hoy).find((a) => a.clave === (req.params.area as ClaveArea))!;
    enviarPdf(res, await informeDeArea(area, periodo, crudos, hoy), `${area.informe} ${periodo.etiqueta}`);
  });

  static leerMemoria = manejar('Error leyendo la Memoria', async (req, res) => {
    res.status(200).json(await MemoriaService.leer(leerCurso(String(req.params.curso))));
  });

  static guardarMemoria = manejar('Error guardando la Memoria', async (req, res) => {
    const curso = leerCurso(String(req.params.curso));
    res.status(200).json(await MemoriaService.guardar(curso, req.body, req.user!, AuditoriaService.metaFromReq(req)));
  });

  /**
   * La Memoria en PDF. La definitiva necesita la presentación y el epílogo; con
   * `?borrador=1` sale siempre, avisando en cada página y con lo que falta a la vista.
   */
  static memoriaPdf = manejar('Error generando la Memoria', async (req, res) => {
    const hoy = new Date();
    const curso = leerCurso(String(req.params.curso), hoy);
    const borrador = req.query.borrador === '1';
    const memoria = await MemoriaService.leer(curso, hoy);
    if (!borrador && memoria.faltan.length) {
      const que = memoria.faltan.map((f) => (f === 'presentacion' ? 'la presentación del Hermano Mayor' : 'el epílogo del Secretario')).join(' y ');
      throw new HttpError(`Falta ${que}: sin eso sale solo el borrador.`, 409);
    }
    const periodo = periodoDe('curso', curso, hoy);
    const crudos = await DatosService.crudos(periodo, hoy);
    const pdf = await memoriaDelCurso(periodo, areasDe(crudos, periodo, hoy), crudos, memoria.textos, { borrador, hoy });
    enviarPdf(res, pdf, `Memoria del curso ${curso}-${curso + 1}${borrador ? ' borrador' : ''}`, borrador);
  });
}
