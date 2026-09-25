import db from '../config/db.js';
import { NotFoundError } from '../utils/error.handle.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';

/**
 * Las secciones guardadas del constructor de páginas: bloques con un nombre
 * para ponerlos igual en otra página. Al ponerlos se copian; cambiar la
 * sección después no cambia las páginas que ya la llevan.
 */
export class SeccionesService {
  static async listar() {
    const filas = await db.seccionGuardada.findMany({ orderBy: { createdAt: 'desc' } });
    return filas.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      bloques: fila.bloques,
      autor: fila.autorNombre,
      fecha: fila.createdAt,
    }));
  }

  static async crear(nombre: string, bloques: unknown[], autorId?: number) {
    const usuario = autorId
      ? await db.user.findUnique({ where: { id: autorId }, select: { nombre: true, apellidos: true } })
      : null;
    const fila = await db.seccionGuardada.create({
      data: {
        nombre: nombre.trim(),
        bloques: bloques as object[],
        autorId: autorId ?? null,
        autorNombre: usuario ? `${usuario.nombre} ${usuario.apellidos}`.trim() : '',
      },
    });
    return { id: fila.id, nombre: fila.nombre, bloques: fila.bloques, autor: fila.autorNombre, fecha: fila.createdAt };
  }

  /** Borra la sección y, con ella, las fotos que solo usaba ella. */
  static async borrar(id: number) {
    const fila = await db.seccionGuardada.findUnique({ where: { id } });
    if (!fila) throw new NotFoundError('Esa sección no existe');
    await db.seccionGuardada.delete({ where: { id } });
    await borrarSubidasHuerfanas(subidasEnTexto(JSON.stringify(fila.bloques)));
  }
}
