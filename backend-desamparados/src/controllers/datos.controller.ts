import type { Response } from 'express';
import { DatosService } from '../services/datos.service.js';
import { InformeAnualService, leerAnio } from '../services/informe-anual.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { informeAnual, informeDeArea } from '../services/informes/informes.js';
import { leerPeriodo, periodoDe } from '../domain/periodo-datos.js';
import { areasDe, type ClaveArea } from '../domain/datos-areas.js';
import { HttpError } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';

/** «Informe de hermanos 2026» → informe-de-hermanos-2026.pdf */
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
    res.status(200).json(await DatosService.leer(leerPeriodo(req.query.anio, hoy), hoy));
  });

  static informe = manejar('Error generando el informe', async (req, res) => {
    const hoy = new Date();
    const periodo = leerPeriodo(req.query.anio, hoy);
    const crudos = await DatosService.crudos(periodo, hoy);
    const area = areasDe(crudos, periodo, hoy).find((a) => a.clave === (req.params.area as ClaveArea))!;
    enviarPdf(res, await informeDeArea(area, periodo, crudos, hoy), `${area.informe} ${periodo.etiqueta}`);
  });

  static leerInformeAnual = manejar('Error leyendo el Informe anual', async (req, res) => {
    res.status(200).json(await InformeAnualService.leer(leerAnio(String(req.params.anio))));
  });

  static guardarInformeAnual = manejar('Error guardando el Informe anual', async (req, res) => {
    const anio = leerAnio(String(req.params.anio));
    res.status(200).json(await InformeAnualService.guardar(anio, req.body, req.user!, AuditoriaService.metaFromReq(req)));
  });

  /**
   * El Informe anual en PDF. El definitivo necesita la presentación y el
   * epílogo; con `?borrador=1` sale siempre, avisando en cada página y con lo
   * que falta a la vista.
   */
  static informeAnualPdf = manejar('Error generando el Informe anual', async (req, res) => {
    const hoy = new Date();
    const anio = leerAnio(String(req.params.anio), hoy);
    const borrador = req.query.borrador === '1';
    const informe = await InformeAnualService.leer(anio, hoy);
    if (!borrador && informe.faltan.length) {
      const que = informe.faltan.map((f) => (f === 'presentacion' ? 'la presentación del Hermano Mayor' : 'el epílogo del Secretario')).join(' y ');
      throw new HttpError(`Falta ${que}: sin eso sale solo el borrador.`, 409);
    }
    const periodo = periodoDe(anio, hoy);
    const crudos = await DatosService.crudos(periodo, hoy);
    const pdf = await informeAnual(periodo, areasDe(crudos, periodo, hoy), crudos, informe.textos, { borrador, hoy });
    enviarPdf(res, pdf, `Informe anual ${anio}${borrador ? ' borrador' : ''}`, borrador);
  });
}
