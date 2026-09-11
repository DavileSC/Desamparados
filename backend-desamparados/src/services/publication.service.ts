import db from '../config/db';
import { Prisma, TipoPublicacion } from '@prisma/client';
import { CreatePublicationDto, UpdatePublicationDto } from '../dtos/publication.dto';
import { NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';
import { esImagenPropia, esPdfPropio, rutaAlEditar } from '../utils/rutas-propias.js';

/** Los valores crudos de la consulta: quien decide qué es válido es sanearPaginacion. */
interface ConsultaPaginada {
  page?: unknown;
  limit?: unknown;
}

export class PublicationService {
  static getLatest() {
    return db.publicacion.findMany({ where: { visible: true }, orderBy: { fecha: 'desc' }, take: 3 });
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

  static async getAdmin(consulta: ConsultaPaginada) {
    const paginacion = sanearPaginacion(consulta);

    const [publicaciones, total] = await db.$transaction([
      db.publicacion.findMany({
        // Mismo desempate que en getPublic: varias publicaciones comparten `fecha` y sin
        // `id` MariaDB las ordenaría a su antojo, repitiendo una entre páginas y perdiendo otra.
        orderBy: [{ fecha: 'desc' }, { id: 'asc' }],
        skip: paginacion.skip,
        take: paginacion.take
      }),
      db.publicacion.count(),
    ]);

    return respuestaPaginada(publicaciones, total, paginacion);
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
