import { EstadisticasDeVisitasService, RUTA_DEL_INFORME } from '../services/estadisticas-de-visitas.service.js';
import { NotFoundError } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';

/**
 * La política del informe. Es un HTML de GoAccess con sus scripts en línea, y
 * enseña textos que llegan de fuera (rutas, procedencias, navegadores): si un
 * texto así colara un script, correría con la sesión del CMS abierta. Por eso
 * va en `sandbox` sin `allow-same-origin`: el navegador lo trata como de otro
 * origen, sin las cookies ni el almacenamiento de la web, y `connect-src
 * 'none'` le impide además llamar a nada. Con eso, sus scripts en línea y su
 * `eval` no tienen nada que alcanzar. Solo se deja enmarcar desde el CMS.
 */
const POLITICA_DEL_INFORME = [
  'sandbox allow-scripts',
  "default-src 'none'",
  // GoAccess compila sus plantillas con `new Function`: sin 'unsafe-eval' sale en blanco.
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

export class EstadisticasDeVisitasController {
  static estado = manejar('Error leyendo las estadísticas de visitas', async (_req, res) => {
    res.status(200).json(await EstadisticasDeVisitasService.estado());
  });

  static informe = manejar('Error abriendo el informe de visitas', async (_req, res) => {
    const { hay } = await EstadisticasDeVisitasService.estado();
    if (!hay) throw new NotFoundError('Todavía no hay informe de visitas.');
    // Helmet pone la política de la web y prohíbe enmarcar: aquí, la del informe.
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', POLITICA_DEL_INFORME);
    res.setHeader('Cache-Control', 'private, no-store');
    res.type('html').sendFile(RUTA_DEL_INFORME);
  });
}
