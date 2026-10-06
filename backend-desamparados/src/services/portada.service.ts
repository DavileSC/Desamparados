import db from '../config/db.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';

export interface ImagenPortadaEntrada {
  url: string;
  descripcion?: string;
  encuadre?: number;
}

export class PortadaService {
  /** Las fotos de la cabecera, en el orden en que rotan. */
  static listarImagenes() {
    return db.imagenPortada.findMany({
      orderBy: { orden: 'asc' },
      select: { id: true, url: true, descripcion: true, encuadre: true, orden: true },
    });
  }

  /**
   * Sustituye la lista entera: la posición en el array es el orden en la
   * portada. Va en una transacción para que un fallo a mitad no deje la
   * cabecera sin fotos.
   */
  static async guardarImagenes(imagenes: ImagenPortadaEntrada[]) {
    const anteriores = await db.imagenPortada.findMany({ select: { url: true } });
    await db.$transaction([
      db.imagenPortada.deleteMany(),
      db.imagenPortada.createMany({
        data: imagenes.map((imagen, orden) => ({
          url: imagen.url,
          descripcion: imagen.descripcion?.trim() || null,
          encuadre: imagen.encuadre ?? null,
          orden,
        })),
      }),
    ]);
    // Las fotos que salen de la lista se borran del disco si ninguna noticia,
    // publicación o página las usa. Solo las subidas del CMS: las del seed
    // (`/storage/public/portada/…`) y las estáticas (`/images/…`) no casan con
    // el filtro de utils/ficheros-publicos.ts y se quedan.
    await borrarSubidasHuerfanas(subidasEnTexto(...anteriores.map((i) => i.url)), {
      conservar: subidasEnTexto(...imagenes.map((i) => i.url)),
    });
    return this.listarImagenes();
  }
}
