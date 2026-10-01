import type { Response } from 'express';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { Modelo182Service, type ConfiguracionModelo182 } from '../services/modelo-182.service.js';

// La validación ya convirtió el ejercicio en número.
const ejercicioDe = (q: unknown) => (q as { ejercicio: number }).ejercicio;

function enviarPdf(res: Response, pdf: Buffer, nombre: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombre}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(pdf);
}

export class Modelo182Controller {
  static resumen = manejar('Error preparando el Modelo 182', async (req, res) => {
    res.json(await Modelo182Service.resumen(ejercicioDe(req.query)));
  });

  static guardarConfiguracion = manejar('Error guardando los datos del Modelo 182', async (req, res) => {
    res.json(await Modelo182Service.guardarConfiguracion(req.body as ConfiguracionModelo182, AuditoriaService.metaFromReq(req)));
  });

  static fichero = manejar('Error sacando el fichero del Modelo 182', async (req, res) => {
    const { justificante } = req.query as { justificante: string };
    const { nombre, contenido } = await Modelo182Service.fichero(ejercicioDe(req.query), justificante, AuditoriaService.metaFromReq(req));
    res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(contenido);
  });

  static certificados = manejar('Error generando los certificados', async (req, res) => {
    const { nif } = req.query as { nif?: string };
    const ejercicio = ejercicioDe(req.query);
    enviarPdf(res, await Modelo182Service.certificados(ejercicio, nif ? [nif] : undefined), `certificados-donativos-${ejercicio}`);
  });

  static enviar = manejar('Error mandando los certificados', async (req, res) => {
    res.json(await Modelo182Service.enviarCertificados(ejercicioDe(req.query), AuditoriaService.metaFromReq(req)));
  });

  // ---- El área de hermanos: los certificados de su cuenta.
  static misCertificados = manejar('Error buscando tus certificados', async (req, res) => {
    res.json(await Modelo182Service.misCertificados(req.user!.id));
  });

  static miCertificado = manejar('Error generando tu certificado', async (req, res) => {
    const { nif } = req.query as { nif?: string };
    const ejercicio = ejercicioDe(req.query);
    enviarPdf(res, await Modelo182Service.miCertificado(req.user!.id, ejercicio, nif ?? ''), `certificado-donativos-${ejercicio}`);
  });
}
