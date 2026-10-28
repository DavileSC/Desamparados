import { WebAbiertaService } from '../services/web-abierta.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';
import { siempreAbiertaEn } from '../domain/web-abierta.js';
import type { Request } from 'express';

/**
 * Lo guardado tal cual, y aparte si aquí se ve abierta igualmente: el CMS de
 * pruebas tiene que enseñar el estado de verdad, no «abierta», o abrir el
 * dominio principal sería un despiste. También al guardar, que la web pone
 * esta respuesta en su caché sin volver a preguntar.
 */
const conEsteNombre = <T extends object>(req: Request, estado: T) => ({
  ...estado,
  siempreAbiertaAqui: siempreAbiertaEn(req.hostname ?? '', process.env.WEB_SIEMPRE_ABIERTA_EN),
});

export class WebAbiertaController {
  /** Sin sesión: la web lo pregunta antes de pintar nada. */
  static leer = manejar('Error leyendo si la web está abierta', async (req, res) => {
    res.status(200).json(conEsteNombre(req, await WebAbiertaService.leer()));
  });

  static guardar = manejar('Error abriendo o cerrando la web', async (req, res) => {
    res.status(200).json(conEsteNombre(req, await WebAbiertaService.guardar(req.body, AuditoriaService.metaFromReq(req))));
  });
}
