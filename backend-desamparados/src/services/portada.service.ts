import db from '../config/db.js';

export interface ImagenPortadaEntrada {
  url: string;
  descripcion?: string;
}

export class PortadaService {
  /** Las fotos de la cabecera, en el orden en que rotan. */
  static listarImagenes() {
    return db.imagenPortada.findMany({
      orderBy: { orden: 'asc' },
      select: { id: true, url: true, descripcion: true, orden: true },
    });
  }

  /**
   * Sustituye la lista entera: la posición en el array es el orden en la
   * portada. Va en una transacción para que un fallo a mitad no deje la
   * cabecera sin fotos.
   */
  static async guardarImagenes(imagenes: ImagenPortadaEntrada[]) {
    await db.$transaction([
      db.imagenPortada.deleteMany(),
      db.imagenPortada.createMany({
        data: imagenes.map((imagen, orden) => ({
          url: imagen.url,
          descripcion: imagen.descripcion?.trim() || null,
          orden,
        })),
      }),
    ]);
    return this.listarImagenes();
  }
}
