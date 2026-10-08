import { SitemapService } from '../services/sitemap.service.js';
import { manejar } from '../utils/manejar.js';

export class SitemapController {
  static xml = manejar('Error preparando el sitemap', async (_req, res) => {
    res
      .status(200)
      .type('application/xml; charset=utf-8')
      // Lo leen los buscadores, no el CMS: una hora de caché no esconde nada
      // a quien edita y ahorra rearmarlo en cada visita de un robot.
      .setHeader('Cache-Control', 'public, max-age=3600')
      .send(await SitemapService.xml());
  });
}
