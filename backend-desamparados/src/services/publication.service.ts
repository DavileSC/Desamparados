import db from '../config/db';
import { TipoPublicacion } from '@prisma/client';
import { CreatePublicationDto, UpdatePublicationDto } from '../dtos/publication.dto';
import { NotFoundError } from '../utils/error.handle';

export class PublicationService {
  static getLatest() {
    return db.publicacion.findMany({ where: { visible: true }, orderBy: { fecha: 'desc' }, take: 3 });
  }

  static getPublic(category?: TipoPublicacion) {
    return db.publicacion.findMany({
      where: { visible: true, ...(category ? { categoria: category } : {}) },
      orderBy: { fecha: 'desc' },
    });
  }

  static getAdmin() {
    return db.publicacion.findMany({ orderBy: { fecha: 'desc' } });
  }

  static create(data: CreatePublicationDto) {
    return db.publicacion.create({
      data: { ...data, fecha: data.fecha ? new Date(data.fecha) : undefined },
    });
  }

  static async update(id: number, data: UpdatePublicationDto) {
    const current = await db.publicacion.findUnique({ where: { id } });
    if (!current) throw new NotFoundError('Publicación no encontrada');
    return db.publicacion.update({
      where: { id },
      data: { ...data, fecha: data.fecha ? new Date(data.fecha) : undefined },
    });
  }

  static async delete(id: number) {
    const current = await db.publicacion.findUnique({ where: { id } });
    if (!current) throw new NotFoundError('Publicación no encontrada');
    return db.publicacion.delete({ where: { id } });
  }
}
