import db from '../config/db';
import { Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import { CreateNewsDto, UpdateNewsDto, NewsFilterDto } from '../dtos/news.dto';

export class NewsService {

  // =================================================================
  //  1. FRONTEND: LECTURA PÚBLICA
  // =================================================================

  // Portada: Límite dinámico configurable desde DB
  static async getLatest() {
    // A) Buscamos la configuración
    const configLimit = await db.configuracion.findUnique({
      where: { key: 'home_news_limit' }
    });

    // B) Parseo seguro (Fallback a 3 si falla)
    const limit = configLimit ? Number(configLimit.value) : 3;

    // C) Query
    return await db.noticia.findMany({
      where: { visible: true },
      orderBy: { fecha: 'desc' },
      take: isNaN(limit) ? 3 : limit 
    });
  }

  // Leer noticia individual por URL amigable
  static async getOneBySlug(slug: string) {
    const noticia = await db.noticia.findUnique({ where: { slug } });
    if (!noticia || !noticia.visible) {
       // Nota: Podrías querer devolverla si es admin, pero eso se gestiona en el controller
       return null; 
    }
    return noticia;
  }

  // =================================================================
  //  2. CMS / GESTIÓN
  // =================================================================

  // Archivo con Paginación + Búsqueda
  static async getArchive({ page, limit, search }: NewsFilterDto) {
    const skip = (page - 1) * limit;

    // Construimos filtro dinámico
    const whereCondition: Prisma.NoticiaWhereInput = {
      // Si hay término de búsqueda, filtramos por título (case insensitive en algunos DBs)
      ...(search && {
        titulo: { contains: search } 
      })
      // Nota: Si es para panel de admin, quitamos 'visible: true' para ver borradores.
      // Si es para web pública, habría que añadir visible: true.
      // Asumiremos que este método es híbrido o para Admin por defecto.
    };

    const [noticias, total] = await db.$transaction([
      db.noticia.findMany({
        where: whereCondition,
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      db.noticia.count({ where: whereCondition })
    ]);

    return {
      data: noticias,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit)
      }
    };
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
          extracto: this.sanitizeExtracto(data.extracto),
          contenido: this.sanitizeContenido(data.contenido),
          imagenUrl: data.imagenUrl,
          visible: data.visible ?? true, // Default true
          fecha: fechaNoticia
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new Error(`Ya existe una noticia con el slug '${finalSlug}'. Intenta cambiar el título.`);
      }
      throw e;
    }
  }

  // Editar Noticia
  static async update(id: number, data: UpdateNewsDto) {
    // Si intentan cambiar el slug manualmente, validamos duplicados
    try {
      return await db.noticia.update({
        where: { id },
        data: {
            titulo: data.titulo,
            extracto: data.extracto !== undefined ? this.sanitizeExtracto(data.extracto) : undefined,
            contenido: data.contenido !== undefined ? this.sanitizeContenido(data.contenido) : undefined,
            imagenUrl: data.imagenUrl,
            visible: data.visible,
            fecha: data.fecha ? new Date(data.fecha) : undefined,
            slug: data.slug // Cuidado: cambiar slug rompe SEO antiguo
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw new Error('El slug indicado ya está en uso.');
      throw e;
    }
  }

  // Borrar Noticia
  static async delete(id: number) {
      return await db.noticia.delete({ where: { id } });
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
   * Sanitiza el HTML del contenido (Prevención de Stored XSS en la web pública).
   * Mismas reglas que las páginas del CMS.
   */
  private static sanitizeContenido(contenido: string): string {
    return sanitizeHtml(contenido, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
      allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, 'img': ['src', 'alt'] }
    });
  }

  /**
   * El extracto se muestra como texto plano en listados: eliminamos todo el HTML.
   */
  private static sanitizeExtracto(extracto?: string): string | undefined {
    if (extracto === undefined) return undefined;
    return sanitizeHtml(extracto, { allowedTags: [], allowedAttributes: {} });
  }

  /**
   * Genera una URL amigable limpia (SEO Friendly)
   * Ej: "Procesión Magna 2024" -> "procesion-magna-2024"
   */
  private static generateSlug(title: string, year: number): string {
    const base = title
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Elimina tildes y diacríticos
      .replace(/ñ/g, "n") // Trata la ñ explícitamente
      .replace(/[^a-z0-9]+/g, "-") // Reemplaza caracteres raros por guiones
      .replace(/(^-|-$)+/g, ""); // Quita guiones al inicio/final

    return `${base}-${year}`;
  }
}