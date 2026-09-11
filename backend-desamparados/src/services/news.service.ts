import db from '../config/db';
import { Prisma } from '@prisma/client';
import { CreateNewsDto, UpdateNewsDto, NewsFilterDto } from '../dtos/news.dto';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { sanearContenidoCms, extractoPlano } from '../utils/sanear-html.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';
import { esImagenPropia, rutaAlEditar } from '../utils/rutas-propias.js';
import { LIMITE_PORTADA_DEFECTO, LIMITE_PORTADA_MAX, LIMITE_PORTADA_MIN } from '../schemas/news.schema.js';

/**
 * El número de noticias de la portada tal y como está guardado. Un valor que no
 * sea un entero dentro de los topes (un «2.5» guardado antes de que el esquema
 * lo impidiera, o una fila tocada a mano) cae al de por defecto: si llegara al
 * `take` de Prisma, la portada pública daría 500 en cada visita.
 */
export function limitePortada(valorGuardado: string | null | undefined): number {
  if (valorGuardado === null || valorGuardado === undefined || valorGuardado.trim() === '') return LIMITE_PORTADA_DEFECTO;
  const limite = Number(valorGuardado);
  return Number.isInteger(limite) && limite >= LIMITE_PORTADA_MIN && limite <= LIMITE_PORTADA_MAX
    ? limite
    : LIMITE_PORTADA_DEFECTO;
}

/**
 * Los extractos guardados antes del arreglo llevan entidades («Cultos &amp;
 * Misa») y la web las pintaba tal cual. Se decodifican al leer en vez de con una
 * migración de datos: `extractoPlano` es idempotente, así que a los nuevos no
 * les cambia nada, y cada noticia vieja queda limpia en cuanto se vuelve a guardar.
 */
function conExtractoPlano<T extends { extracto: string | null }>(noticia: T): T {
  return noticia.extracto ? { ...noticia, extracto: extractoPlano(noticia.extracto) } : noticia;
}

/** '' es «sin foto» (lo que manda «Quitar foto» del CMS): se guarda como null. */
function imagenAGuardar(imagenUrl: string | null | undefined): string | null | undefined {
  return imagenUrl === '' ? null : imagenUrl;
}

export class NewsService {

  // =================================================================
  //  1. FRONTEND: LECTURA PÚBLICA
  // =================================================================

  // Portada: Límite dinámico configurable desde DB
  static async getLatest() {
    const configLimit = await db.configuracion.findUnique({
      where: { key: 'home_news_limit' }
    });

    const noticias = await db.noticia.findMany({
      where: { visible: true },
      orderBy: [{ fecha: 'desc' }, { id: 'asc' }],
      take: limitePortada(configLimit?.value)
    });
    return noticias.map(conExtractoPlano);
  }

  // Leer noticia individual por URL amigable
  static async getOneBySlug(slug: string) {
    const noticia = await db.noticia.findUnique({ where: { slug } });
    if (!noticia || !noticia.visible) {
       // Nota: Podrías querer devolverla si es admin, pero eso se gestiona en el controller
       return null;
    }
    return conExtractoPlano(noticia);
  }

  // Leer noticia individual por id, incluidos los borradores (CMS). Antes el
  // cliente se traía el listado paginado y buscaba dentro con un .find(): una
  // noticia fuera del recorte era imposible de editar.
  static async getOneById(id: number) {
    const noticia = await db.noticia.findUnique({ where: { id } });
    return noticia ? conExtractoPlano(noticia) : null;
  }

  // =================================================================
  //  2. CMS / GESTIÓN
  // =================================================================

  // Archivo con Paginación + Búsqueda
  static async getArchive({ page, limit, search, includeDrafts = false }: NewsFilterDto) {
    const paginacion = sanearPaginacion({ page, limit });

    // Construimos filtro dinámico
    const whereCondition: Prisma.NoticiaWhereInput = {
      // SEGURIDAD: la web pública SOLO ve noticias publicadas. Los borradores únicamente
      // se listan desde la ruta de administración (includeDrafts = true, tras auth + rol CMS).
      ...(includeDrafts ? {} : { visible: true }),
      // Si hay término de búsqueda, filtramos por título
      ...(search && {
        titulo: { contains: search }
      })
    };

    const [noticias, total] = await db.$transaction([
      db.noticia.findMany({
        where: whereCondition,
        orderBy: [
          { fecha: 'desc' },
          { id: 'asc' } // Desempate: dos noticias publicadas el mismo día comparten `fecha`
                        // (los avisos de unos mismos cultos suelen subirse juntos), y sin este
                        // criterio MariaDB no garantiza el mismo orden entre la página 1 y
                        // la 2: una saldría dos veces y otra ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.noticia.count({ where: whereCondition })
    ]);

    return respuestaPaginada(noticias.map(conExtractoPlano), total, paginacion);
  }

  // Crear Noticia
  static async create(data: CreateNewsDto) {
    // 1. Calcular fecha
    const fechaNoticia = data.fecha ? new Date(data.fecha) : new Date();

    // 2. Generar Slug si no viene dado
    let finalSlug = data.slug;
    if (!finalSlug) {
      finalSlug = this.generateSlug(data.titulo, fechaNoticia.getFullYear());
    }

    try {
      return await db.noticia.create({
        data: {
          titulo: data.titulo,
          slug: finalSlug,
          extracto: data.extracto !== undefined ? extractoPlano(data.extracto) : undefined,
          contenido: sanearContenidoCms(data.contenido),
          imagenUrl: imagenAGuardar(data.imagenUrl),
          visible: data.visible ?? true, // Default true
          fecha: fechaNoticia
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new HttpError(`Ya existe una noticia con el slug '${finalSlug}'. Intenta cambiar el título.`);
      }
      throw e;
    }
  }

  // Editar Noticia
  static async update(id: number, data: UpdateNewsDto) {
    // Lo de antes hace falta para saber qué ficheros deja de usar la noticia.
    const anterior = await db.noticia.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundError('Noticia no encontrada');

    let actualizada;
    // Si intentan cambiar el slug manualmente, validamos duplicados
    try {
      actualizada = await db.noticia.update({
        where: { id },
        data: {
            titulo: data.titulo,
            extracto: data.extracto !== undefined ? extractoPlano(data.extracto) : undefined,
            contenido: data.contenido !== undefined ? sanearContenidoCms(data.contenido) : undefined,
            // Validada contra la guardada: si no cambia, no se toca (ver rutaAlEditar).
            imagenUrl: rutaAlEditar(data.imagenUrl, anterior.imagenUrl, {
              esValida: esImagenPropia,
              mensaje: 'La foto de la noticia no es una imagen del propio sitio: vuelve a subirla con «Cambiar foto».',
            }),
            visible: data.visible,
            fecha: data.fecha ? new Date(data.fecha) : undefined,
            slug: data.slug // Cuidado: cambiar slug rompe SEO antiguo
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw new HttpError('El slug indicado ya está en uso.');
      throw e;
    }

    // La foto sustituida o quitada, y las incrustadas que ya no están en el
    // cuerpo, se borran del disco si ningún otro registro las usa.
    await borrarSubidasHuerfanas(subidasEnTexto(anterior.imagenUrl, anterior.contenido), {
      conservar: subidasEnTexto(actualizada.imagenUrl, actualizada.contenido),
    });
    return actualizada;
  }

  // Borrar Noticia
  static async delete(id: number) {
    const noticia = await db.noticia.findUnique({ where: { id } });
    if (!noticia) throw new NotFoundError('Noticia no encontrada');
    const borrada = await db.noticia.delete({ where: { id } });
    await borrarSubidasHuerfanas(subidasEnTexto(noticia.imagenUrl, noticia.contenido));
    return borrada;
  }

  // Configuración Home
  static async setHomeLimit(newLimit: number) {
    return await db.configuracion.upsert({
      where: { key: 'home_news_limit' },
      update: { value: String(newLimit) },
      create: {
        key: 'home_news_limit',
        value: String(newLimit),
        descripcion: 'Número de noticias visibles en la portada'
      }
    });
  }

  // =================================================================
  //  UTILIDADES PRIVADAS
  // =================================================================

  /**
   * Genera una URL amigable limpia (SEO Friendly)
   * Ej: "Procesión Magna 2024" -> "procesion-magna-2024"
   */
  private static generateSlug(title: string, year: number): string {
    const base = title
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "") // Elimina tildes y diacríticos
      .replace(/ñ/g, "n") // Trata la ñ explícitamente
      .replace(/[^a-z0-9]+/g, "-") // Reemplaza caracteres raros por guiones
      .replace(/(^-|-$)+/g, ""); // Quita guiones al inicio/final

    return `${base}-${year}`;
  }
}
