import rutasPublicas from '../../../shared/rutas-publicas.json' with { type: 'json' };
import db from '../config/db.js';
import { identidad } from '../domain/datos-entidad.js';
import { esClaveEncendible, NUCLEO, type ClaveEncendible } from '../domain/modulos.js';
import { ModulosService } from './modulos.service.js';

/**
 * El sitemap de la web pública, en /sitemap.xml.
 *
 * Antes era un fichero estático que generaba la web al construirse: solo
 * conocía el lote inicial de módulos (uno apagado desde el CMS seguía
 * anunciado) y no podía nombrar las noticias, que viven en la base. Aquí se
 * arma en cada petición con lo de ahora: las páginas fijas del router
 * (shared/rutas-publicas.json, que genera `npm run sitemap` en la web) de los
 * módulos encendidos, cada noticia publicada y cada producto a la venta en
 * la tienda de la web, con su fecha de cambio.
 */

interface RutaPublica { ruta: string; requisito: string[] }

/** Las rutas con parámetro que se rellenan: el detalle de una noticia y la ficha de un producto. */
const RUTA_DE_NOTICIA = '/noticias/:slug';
const RUTA_DE_PRODUCTO = '/tienda/producto/:id';

const RUTAS: readonly RutaPublica[] = rutasPublicas.rutas;

const escaparXml = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Como en la web: una ruta con varios módulos se enseña si alguno está encendido. */
const cumple = (requisito: readonly string[], activos: ReadonlySet<ClaveEncendible>) =>
  requisito.some((m) => m === NUCLEO || (esClaveEncendible(m) && activos.has(m)));

interface EntradaSitemap { ruta: string; lastmod?: Date }

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

    // La ficha de un producto se indexa (la tienda solo pone `noindex` al que
    // ya no está): los mismos que la tienda de la web, los activos.
    const deProducto = RUTAS.find((r) => r.ruta === RUTA_DE_PRODUCTO);
    const productos = deProducto && cumple(deProducto.requisito, activos)
      ? await db.producto.findMany({
        where: { activo: true },
        orderBy: [{ orden: 'asc' }, { id: 'asc' }],
        select: { id: true, updatedAt: true },
      })
      : [];

    return [
      ...fijas,
      ...noticias.map((n) => ({ ruta: RUTA_DE_NOTICIA.replace(':slug', encodeURIComponent(n.slug)), lastmod: n.updatedAt })),
      ...productos.map((p) => ({ ruta: RUTA_DE_PRODUCTO.replace(':id', String(p.id)), lastmod: p.updatedAt })),
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
