import db from '../config/db';
import { Prisma, TipoPublicacion } from '@prisma/client';
import { AdminPublicationFilterDto, CreatePublicationDto, UpdatePublicationDto } from '../dtos/publication.dto';
import { NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';
import { esImagenPropia, esPdfPropio, rutaAlEditar } from '../utils/rutas-propias.js';
import { condicionBusqueda } from '../domain/busqueda-texto.js';
import { PDF_DE_RELLENO, type EstadoPublicacion } from '../schemas/publication.schema.js';

/** Los valores crudos de la consulta: quien decide qué es válido es sanearPaginacion. */
interface ConsultaPaginada {
  page?: unknown;
  limit?: unknown;
}

/** Las que enseña la portada de la web: las más recientes publicadas, de cualquier tipo. */
export const PUBLICACIONES_EN_PORTADA = 3;

/**
 * El `where` de cada apartado del listado del CMS. «Incompletas» son las que
 * en la web quedan cojas: sin portada (la tarjeta del listado se queda sin
 * imagen), sin descripción (solo el título) o con el PDF de relleno del seed,
 * que se descargaría en lugar del de verdad. '' cuenta como vacío porque los
 * campos borrados se guardan así.
 */
export function condicionEstadoPublicacion(estado: EstadoPublicacion | undefined): Prisma.PublicacionWhereInput {
  switch (estado) {
    case 'publicadas': return { visible: true };
    case 'borradores': return { visible: false };
    case 'incompletas': return { OR: [{ imagenUrl: null }, { imagenUrl: '' }, { descripcion: null }, { descripcion: '' }, { archivoUrl: PDF_DE_RELLENO }] };
    default: return {};
  }
}

export class PublicationService {
  static getLatest() {
    // Mismo orden que el listado del CMS, desempate incluido: la raya de «hasta
    // aquí sale en la portada» tiene que coincidir con lo que sale.
    return db.publicacion.findMany({ where: { visible: true }, orderBy: [{ fecha: 'desc' }, { id: 'asc' }], take: PUBLICACIONES_EN_PORTADA });
  }

  static async getPublic(category: TipoPublicacion | undefined, consulta: ConsultaPaginada) {
    const paginacion = sanearPaginacion(consulta);
    const where: Prisma.PublicacionWhereInput = { visible: true, ...(category ? { categoria: category } : {}) };

    const [publicaciones, total] = await db.$transaction([
      db.publicacion.findMany({
        where,
        orderBy: [
          { fecha: 'desc' },
          { id: 'asc' } // Desempate: un boletín y sus anexos se suben con la misma `fecha`,
                        // y sin este criterio MariaDB no garantiza el mismo orden entre la
                        // página 1 y la 2: una publicación saldría dos veces y otra ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.publicacion.count({ where }),
    ]);

    return respuestaPaginada(publicaciones, total, paginacion);
  }

  /**
   * Listado del CMS: borradores incluidos, con búsqueda por palabras en título
   * y descripción, el apartado y el tipo que se pidan.
   *
   * Sin apartado, los borradores van primero: son lo que está a medio hacer.
   * Luego lo publicado, por fecha.
   *
   * Además de la página, devuelve un `resumen` para la cabecera: cuántas hay
   * en cada apartado (del tipo elegido, sin contar la búsqueda, para que las
   * cifras no bailen al teclear) y cuáles salen ahora mismo en la portada, que
   * son las mismas que sirve getLatest.
   */
  static async getAdmin({ page, limit, q, estado, categoria }: AdminPublicationFilterDto) {
    const paginacion = sanearPaginacion({ page, limit });
    const delTipo: Prisma.PublicacionWhereInput = categoria ? { categoria } : {};
    const where: Prisma.PublicacionWhereInput = {
      ...delTipo,
      ...condicionEstadoPublicacion(estado),
      ...condicionBusqueda(q, ['titulo', 'descripcion'] as const),
    };
    const contar = (apartado: EstadoPublicacion) => db.publicacion.count({ where: { ...delTipo, ...condicionEstadoPublicacion(apartado) } });

    const [publicaciones, total, publicadas, borradores, incompletas, enPortada] = await db.$transaction([
      db.publicacion.findMany({
        where,
        // Mismo desempate que en getPublic: varias publicaciones comparten `fecha` y sin
        // `id` MariaDB las ordenaría a su antojo, repitiendo una entre páginas y perdiendo otra.
        orderBy: [{ visible: 'asc' }, { fecha: 'desc' }, { id: 'asc' }],
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.publicacion.count({ where }),
      contar('publicadas'),
      contar('borradores'),
      contar('incompletas'),
      db.publicacion.findMany({
        where: { visible: true },
        orderBy: [{ fecha: 'desc' }, { id: 'asc' }],
        take: PUBLICACIONES_EN_PORTADA,
        select: { id: true, fecha: true },
      }),
    ]);

    return {
      ...respuestaPaginada(publicaciones, total, paginacion),
      resumen: {
        publicadas,
        borradores,
        incompletas,
        ultimaPublicacion: enPortada[0]?.fecha ?? null,
        portada: { limite: PUBLICACIONES_EN_PORTADA, ids: enPortada.map((p) => p.id) },
      },
    };
  }

  /**
   * Lectura individual para el CMS, borradores incluidos. Antes el cliente se
   * traía el listado y buscaba dentro con un .find(): una publicación fuera del
   * recorte era imposible de editar.
   */
  static getOne(id: number) {
    return db.publicacion.findUnique({ where: { id } });
  }

  static create(data: CreatePublicationDto) {
    return db.publicacion.create({
      data: { ...data, imagenUrl: data.imagenUrl || null, fecha: data.fecha ? new Date(data.fecha) : undefined },
    });
  }

  static async update(id: number, data: UpdatePublicationDto) {
    const current = await db.publicacion.findUnique({ where: { id } });
    if (!current) throw new NotFoundError('Publicación no encontrada');
    const actualizada = await db.publicacion.update({
      where: { id },
      data: {
        ...data,
        // Las dos rutas se validan contra lo guardado: el formulario reenvía la
        // ficha entera, y una publicación con un PDF de antes de la validación
        // (una URL tecleada en el antiguo campo de texto) no podía volver a
        // guardarse por un campo que nadie había tocado. Si cambian, tienen que
        // ser rutas propias; '' en la portada es «sin portada».
        imagenUrl: rutaAlEditar(data.imagenUrl, current.imagenUrl, {
          esValida: esImagenPropia,
          mensaje: 'La portada de la publicación no es una imagen del propio sitio: vuelve a subirla con «Cambiar foto».',
        }),
        archivoUrl: rutaAlEditar(data.archivoUrl, current.archivoUrl, {
          esValida: esPdfPropio,
          siFalta: 'Falta el PDF de la publicación: súbelo con «Subir PDF» antes de guardar.',
          mensaje: 'El PDF de la publicación no es un archivo subido desde el CMS: vuelve a subirlo con «Cambiar PDF».',
        }) ?? undefined,
        fecha: data.fecha ? new Date(data.fecha) : undefined,
      },
    });
    // La portada y el PDF sustituidos o quitados salen del disco si ningún otro
    // registro los usa: seguían descargándose en /storage/public para siempre.
    await borrarSubidasHuerfanas(subidasEnTexto(current.imagenUrl, current.archivoUrl, current.descripcion), {
      conservar: subidasEnTexto(actualizada.imagenUrl, actualizada.archivoUrl, actualizada.descripcion),
    });
    return actualizada;
  }

  static async delete(id: number) {
    const current = await db.publicacion.findUnique({ where: { id } });
    if (!current) throw new NotFoundError('Publicación no encontrada');
    const borrada = await db.publicacion.delete({ where: { id } });
    await borrarSubidasHuerfanas(subidasEnTexto(current.imagenUrl, current.archivoUrl, current.descripcion));
    return borrada;
  }
}
