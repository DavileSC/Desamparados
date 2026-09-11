import db from '../config/db';
import { SavePaginaDto, UpdatePaginaDto } from '../dtos/pagina.dto';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearContenidoCms } from '../utils/sanear-html.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';

export class PaginaService {

  // =================================================================
  //  1. LECTURA PÚBLICA
  // =================================================================

  /**
   * Obtiene una página por su URL amigable (slug).
   * Ej: /api/pages/historia
   */
  static async getPaginaBySlug(slug: string) {
    const pagina = await db.pagina.findUnique({
      where: { slug }
    });
    
    // Si no existe, devolvemos null.
    // El Controller se encargará de mandar un 404 si recibe null.
    return pagina;
  }

  // =================================================================
  //  2. GESTIÓN (ADMIN)
  // =================================================================

  /**
   * CREAR una página nueva.
   * Protege contra duplicados comprobando el slug antes.
   */
  static async createPagina(data: SavePaginaDto) {
    // 1. Normalizar Slug (Seguridad)
    // Si el admin envía "Historia del Grupo Parroquial", lo convertimos a "historia-de-la-grupo parroquial"
    const finalSlug = this.normalizeSlug(data.slug);

    // 2. Sanitizar el contenido HTML (Prevención de Stored XSS)
    const cleanContent = this.sanitizeContenido(data.contenido);

    // Es un upsert: si la página ya existía, las fotos que quite del cuerpo
    // tienen que salir también del disco.
    const anterior = await db.pagina.findUnique({ where: { slug: finalSlug }, select: { contenido: true } });

    const pagina = await db.pagina.upsert({
      where: { slug: finalSlug },
      update: { 
        titulo: data.titulo, 
        contenido: cleanContent,
        updatedAt: new Date() // Forzamos actualización de fecha
      },
      create: { 
        slug: finalSlug, 
        titulo: data.titulo, 
        contenido: cleanContent
      }
    });
    if (anterior) await borrarSubidasHuerfanas(subidasEnTexto(anterior.contenido), { conservar: subidasEnTexto(pagina.contenido) });
    return pagina;
  }

  /**
   * ACTUALIZAR una página existente.
   * No tocamos el slug original para no romper el SEO.
   */
  static async updatePagina(slugOriginal: string, data: UpdatePaginaDto) {
    // 1. Comprobamos que la página que intentan editar realmente existe
    const existe = await db.pagina.findUnique({ where: { slug: slugOriginal } });
    if (!existe) throw new NotFoundError('La página que intentas actualizar no existe.');

    // 2. Actualizamos (Prisma se encarga de cambiar el updatedAt automáticamente)
    // Sanitizamos igual que en create para prevenir Stored XSS
    const pagina = await db.pagina.update({
      where: { slug: slugOriginal },
      data: { 
        titulo: data.titulo, 
        contenido: data.contenido !== undefined ? this.sanitizeContenido(data.contenido) : undefined
      }
    });
    // Las fotos que ya no están en el cuerpo salen del disco si nadie más las usa.
    await borrarSubidasHuerfanas(subidasEnTexto(existe.contenido), { conservar: subidasEnTexto(pagina.contenido) });
    return pagina;
  }
  
  /**
   * Listado ligero para el menú del Admin (sin el contenido pesado)
   */
  static async getAllSlugs() {
      return await db.pagina.findMany({
          orderBy: { slug: 'asc' },
          select: { 
            slug: true, 
            titulo: true, 
            updatedAt: true 
          }
      });
  }

  /**
   * Eliminar una página del sistema.
   */
  static async deletePagina(slug: string) {
    // Medida de seguridad: Evitar que se borren páginas críticas por error.
    const protectedSlugs = ['home', 'contacto', 'aviso-legal'];
    if (protectedSlugs.includes(slug)) throw new HttpError(`La página '${slug}' está protegida y no se puede eliminar.`);

    const pagina = await db.pagina.delete({
      where: { slug }
    });
    await borrarSubidasHuerfanas(subidasEnTexto(pagina.contenido));
    return pagina;
  }

  // =================================================================
  //  UTILIDADES
  // =================================================================

  /**
   * Limpia el HTML con las mismas reglas que las noticias (utils/sanear-html.ts):
   * formato sí, scripts no, imágenes solo del propio sitio y enlaces que abren
   * pestaña siempre con `rel="noopener noreferrer"`.
   */
  private static sanitizeContenido(contenido: string): string {
    return sanearContenidoCms(contenido);
  }

  /**
   * Limpia el texto para crear URLs amigables y seguras.
   */
  private static normalizeSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Tildes fuera
      .replace(/ñ/g, "n") 
      .replace(/\s+/g, '-') // Espacios a guiones
      .replace(/[^a-z0-9-]/g, ''); // Eliminar caracteres raros
  }
}