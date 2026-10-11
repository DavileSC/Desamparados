import db from '../config/db';
import { Prisma } from '@prisma/client';
import { CrearNoticiaDto, ActualizarNoticiaDto, FiltroNoticiasDto, FiltroNoticiasCmsDto } from '../dtos/noticia.dto';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { sanearContenidoCms, extractoPlano } from '../utils/sanear-html.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';
import { esImagenPropia, rutaAlEditar } from '../utils/rutas-propias.js';
import type { EstadoNoticia } from '../schemas/noticia.schema.js';
import { condicionBusqueda } from '../domain/busqueda-texto.js';
import { fechaMasReciente, marcaDestacada } from '../domain/destacada-portada.js';
import { slugDeNoticia } from '../domain/slug-noticia.js';

/**
 * Las noticias de la portada: tres, las que caben en su rejilla de tres
 * columnas (FeaturedNews en el frontend). Antes era un ajuste del CMS de 1 a
 * 20, pero la portada cortaba en tres de todos modos: con 5, el CMS decía que
 * salían cinco y salían tres; y si de verdad saliera otro número, la rejilla
 * quedaría con huecos o una fila coja. Como en Publicaciones y la Agenda, el
 * número lo pone el diseño de la portada.
 */
export const NOTICIAS_EN_PORTADA = 3;

/**
 * El orden de la portada: delante la destacada, si hay alguna, y detrás las más
 * recientes. El desempate por id importa porque dos noticias del mismo día
 * comparten `fecha` y sin él MariaDB no garantiza el mismo orden en dos
 * consultas: la raya del CMS («hasta aquí sale en la portada») dejaría de
 * coincidir con lo que sale de verdad.
 */
const ORDEN_PORTADA = [
  { fijada: 'desc' },
  { fecha: 'desc' },
  { id: 'asc' },
] satisfies Prisma.NoticiaOrderByWithRelationInput[];

/**
 * Los extractos guardados antes del arreglo llevan entidades («Cultos &amp;
 * Misa») y la web las pintaba tal cual. Se decodifican al leer en vez de con una
 * migración de datos: `extractoPlano` es idempotente, así que a los nuevos no
 * les cambia nada, y cada noticia vieja queda limpia en cuanto se vuelve a guardar.
 */
function conExtractoPlano<T extends { extracto: string | null }>(noticia: T): T {
  return noticia.extracto ? { ...noticia, extracto: extractoPlano(noticia.extracto) } : noticia;
}

/**
 * El `where` de cada apartado del listado del CMS. «Incompletas» son las que
 * en la web quedan cojas: sin foto (la tarjeta cae a una placa con la inicial)
 * o sin extracto (la tarjeta se queda en el título). '' cuenta como vacío
 * porque los extractos borrados se guardan así.
 */
export function condicionEstadoNoticia(estado: EstadoNoticia | undefined): Prisma.NoticiaWhereInput {
  switch (estado) {
    case 'publicadas': return { visible: true };
    case 'borradores': return { visible: false };
    case 'incompletas': return { OR: [{ imagenUrl: null }, { imagenUrl: '' }, { extracto: null }, { extracto: '' }] };
    default: return {};
  }
}

/** '' es «sin foto» (lo que manda «Quitar foto» del CMS): se guarda como null. */
function imagenAGuardar(imagenUrl: string | null | undefined): string | null | undefined {
  return imagenUrl === '' ? null : imagenUrl;
}

export class NoticiaService {

  // =================================================================
  //  1. FRONTEND: LECTURA PÚBLICA
  // =================================================================

  // Portada: la destacada y, tras ella, las más recientes hasta NOTICIAS_EN_PORTADA.
  // Los listados van sin `contenido`: la tarjeta usa el extracto, y el HTML de
  // cada noticia (hasta 2 MB) solo lo pide su ficha.
  static async deLaPortada() {
    const noticias = await db.noticia.findMany({
      where: { visible: true },
      omit: { contenido: true },
      orderBy: ORDEN_PORTADA,
      take: NOTICIAS_EN_PORTADA
    });
    return noticias.map(conExtractoPlano);
  }

  // Leer noticia individual por URL amigable
  static async porDireccion(slug: string) {
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
  static async porId(id: number) {
    const noticia = await db.noticia.findUnique({ where: { id } });
    return noticia ? conExtractoPlano(noticia) : null;
  }

  // =================================================================
  //  2. CMS / GESTIÓN
  // =================================================================

  // Archivo PÚBLICO con paginación y búsqueda por título: solo lo publicado.
  static async archivoPublico({ page, limit, search }: FiltroNoticiasDto) {
    const paginacion = sanearPaginacion({ page, limit });

    const whereCondition: Prisma.NoticiaWhereInput = {
      // SEGURIDAD: la web pública SOLO ve noticias publicadas. Los borradores
      // se listan desde getAdminArchive, tras auth + rol CMS.
      visible: true,
      ...(search && {
        titulo: { contains: search }
      })
    };

    const [noticias, total] = await db.$transaction([
      db.noticia.findMany({
        where: whereCondition,
        omit: { contenido: true }, // Como en la portada: el cuerpo solo lo pide la ficha.
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

  /**
   * Listado del CMS: borradores incluidos, con búsqueda por palabras en título
   * y extracto, y el apartado que se pida.
   *
   * Sin apartado, los borradores van primero: son lo que está a medio hacer y
   * lo que se viene a terminar. Luego la destacada de la portada y el resto de
   * lo publicado, por fecha. La destacada sube aunque sea vieja a propósito: la
   * raya de «hasta aquí sale en la portada» se dibuja tras la última fila que
   * está en portada, y con la destacada hundida en el listado caería en mitad
   * de la página sin querer decir nada.
   *
   * Además de la página, devuelve un `resumen` para la cabecera del listado:
   * cuántas hay en cada apartado (del archivo entero, no de la búsqueda, para
   * que las cifras no bailen al teclear) y qué noticias salen ahora mismo en la
   * portada, que son las mismas que sirve getLatest.
   */
  static async archivoDelCms({ page, limit, q, estado }: FiltroNoticiasCmsDto) {
    const paginacion = sanearPaginacion({ page, limit });
    const where: Prisma.NoticiaWhereInput = {
      ...condicionEstadoNoticia(estado),
      ...condicionBusqueda(q, ['titulo', 'extracto'] as const),
    };

    const [noticias, total, publicadas, borradores, incompletas] = await db.$transaction([
      db.noticia.findMany({
        where,
        orderBy: [{ visible: 'asc' }, ...ORDEN_PORTADA],
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.noticia.count({ where }),
      db.noticia.count({ where: condicionEstadoNoticia('publicadas') }),
      db.noticia.count({ where: condicionEstadoNoticia('borradores') }),
      db.noticia.count({ where: condicionEstadoNoticia('incompletas') }),
    ]);

    const limite = NOTICIAS_EN_PORTADA;
    const enPortada = await db.noticia.findMany({
      where: { visible: true },
      orderBy: ORDEN_PORTADA,
      take: limite,
      select: { id: true, fecha: true, fijada: true },
    });

    return {
      ...respuestaPaginada(noticias.map(conExtractoPlano), total, paginacion),
      resumen: {
        publicadas,
        borradores,
        incompletas,
        // La fecha más reciente de las que salen, no la de la primera: desde que
        // hay destacada, la primera puede ser una noticia vieja que se ha fijado.
        // El máximo sigue siendo la última publicación, porque las plazas que no
        // ocupa la destacada se llenan por fecha.
        ultimaPublicacion: fechaMasReciente(enPortada),
        portada: {
          limite,
          ids: enPortada.map((n) => n.id),
          fijada: enPortada.find((n) => n.fijada)?.id ?? null,
        },
      },
    };
  }

  // Crear Noticia
  static async crear(data: CrearNoticiaDto) {
    // 1. Calcular fecha
    const fechaNoticia = data.fecha ? new Date(data.fecha) : new Date();

    // 2. Generar Slug si no viene dado
    let finalSlug = data.slug;
    if (!finalSlug) {
      finalSlug = slugDeNoticia(data.titulo, fechaNoticia.getFullYear());
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
  static async actualizar(id: number, data: ActualizarNoticiaDto) {
    // Lo de antes hace falta para saber qué ficheros deja de usar la noticia.
    const anterior = await db.noticia.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundError('Noticia no encontrada');

    // Las reglas de la destacada (una sola, publicada, y se suelta al pasar a
    // borrador) son las mismas en Publicaciones: domain/destacada-portada.
    const marca = marcaDestacada(data, anterior);
    const soltarLasDemas = db.noticia.updateMany({
      where: { fijada: true, id: { not: id } },
      data: { fijada: false },
    });

    let actualizada;
    // Si intentan cambiar el slug manualmente, validamos duplicados
    try {
      const guardar = db.noticia.update({
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
            fijada: marca.fijada,
            fecha: data.fecha ? new Date(data.fecha) : undefined,
            slug: data.slug // Cuidado: cambiar slug rompe SEO antiguo
        }
      });
      // En una transacción para que no quede un hueco en el que la portada no
      // tenga destacada (o tenga dos) si el segundo paso falla.
      [, actualizada] = marca.soltarLasDemas
        ? await db.$transaction([soltarLasDemas, guardar])
        : [null, await guardar];
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
  static async eliminar(id: number) {
    const noticia = await db.noticia.findUnique({ where: { id } });
    if (!noticia) throw new NotFoundError('Noticia no encontrada');
    const borrada = await db.noticia.delete({ where: { id } });
    await borrarSubidasHuerfanas(subidasEnTexto(noticia.imagenUrl, noticia.contenido));
    return borrada;
  }

  // =================================================================
  //  UTILIDADES PRIVADAS
  // =================================================================

  /**
   * Genera una URL amigable limpia (SEO Friendly)
   * Ej: "Procesión Magna 2024" -> "procesion-magna-2024"
   */
}
