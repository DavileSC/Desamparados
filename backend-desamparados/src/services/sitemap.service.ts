import rutasPublicas from '../../../shared/rutas-publicas.json' with { type: 'json' };
import db from '../config/db.js';
import { identidad } from '../domain/datos-entidad.js';
import { esClaveDeModulo, NUCLEO, type ClaveModulo } from '../domain/modulos.js';
import { ModulosService } from './modulos.service.js';

/**
 * El sitemap de la web pública, en /sitemap.xml.
 *
 * Antes era un fichero estático que generaba la web al construirse: solo
 * conocía el lote inicial de módulos (uno apagado desde el CMS seguía
 * anunciado) y no podía nombrar las noticias, que viven en la base. Aquí se
 * arma en cada petición con lo de ahora: las páginas fijas del router
 * (shared/rutas-publicas.json, que genera `npm run sitemap` en la web) de los
 * módulos encendidos, y cada noticia publicada con su fecha de cambio.
 */

interface RutaPublica { ruta: string; requisito: string[] }

/** El detalle de una noticia: la única ruta con parámetro que se rellena. */
export const RUTA_DE_NOTICIA = '/noticias/:slug';

const RUTAS: readonly RutaPublica[] = rutasPublicas.rutas;

const escaparXml = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Como en la web: una ruta con varios módulos se enseña si alguno está encendido. */
const cumple = (requisito: readonly string[], activos: ReadonlySet<ClaveModulo>) =>
  requisito.some((m) => m === NUCLEO || (esClaveDeModulo(m) && activos.has(m)));

export interface EntradaSitemap { ruta: string; lastmod?: Date }

export class SitemapService {
  /** Las direcciones que se anuncian, sin el dominio. */
  static async entradas(): Promise<EntradaSitemap[]> {
    const activos = await ModulosService.activos();
    const fijas = RUTAS
      .filter(({ ruta, requisito }) => !ruta.includes(':') && cumple(requisito, activos))
      .map(({ ruta }) => ({ ruta }));

    const deNoticia = RUTAS.find((r) => r.ruta === RUTA_DE_NOTICIA);
    const noticias = deNoticia && cumple(deNoticia.requisito, activos)
      // Las mismas que ve la web: solo las publicadas (`porDireccion` responde
      // «no encontrada» a un borrador).
      ? await db.noticia.findMany({
        where: { visible: true },
        orderBy: [{ fecha: 'desc' }, { id: 'asc' }],
        select: { slug: true, updatedAt: true },
      })
      : [];

    return [
      ...fijas,
      ...noticias.map((n) => ({ ruta: RUTA_DE_NOTICIA.replace(':slug', encodeURIComponent(n.slug)), lastmod: n.updatedAt })),
    ];
  }

  static async xml(): Promise<string> {
    const dominio = `https://${identidad.dominio}`;
    const urls = (await SitemapService.entradas()).map(({ ruta, lastmod }) =>
      `  <url><loc>${escaparXml(dominio + ruta)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}</url>`);
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls,
      '</urlset>',
      '',
    ].join('\n');
  }
}
