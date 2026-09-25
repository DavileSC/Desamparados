import db from '../config/db.js';
import { mezclarConDefectos, porDefecto, type SlugContenido } from '../domain/contenido.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';
import { NotFoundError } from '../utils/error.handle.js';

/**
 * Cuántas versiones se guardan de cada página. Con más, el historial crece sin
 * límite y cada una retiene sus fotos en el disco (ver `ficheros-publicos.ts`);
 * con cincuenta caben meses de cambios de una página que se toca a menudo.
 */
export const VERSIONES_POR_PAGINA = 50;

/** Quién guarda: se copia a la versión para que siga diciéndolo si la cuenta se borra. */
async function autorDe(autorId?: number): Promise<{ autorId: number | null; autorNombre: string }> {
  if (!autorId) return { autorId: null, autorNombre: '' };
  const usuario = await db.user.findUnique({ where: { id: autorId }, select: { nombre: true, apellidos: true } });
  return { autorId, autorNombre: usuario ? `${usuario.nombre} ${usuario.apellidos}`.trim() : '' };
}

/** Un resumen de una versión para la lista del historial. */
function resumenDe(datos: unknown): { titulo: string; bloques: number } {
  const documento = datos as { cabecera?: { titulo?: unknown }; bloques?: unknown };
  return {
    titulo: typeof documento?.cabecera?.titulo === 'string' ? documento.cabecera.titulo : '',
    bloques: Array.isArray(documento?.bloques) ? documento.bloques.length : 0,
  };
}

export class ContenidoService {
  /**
   * El documento de una página, ya mezclado con los textos de siempre. Si la
   * fila no existe (base recién creada, siembra no ejecutada), se devuelven los
   * valores por defecto en vez de un 404: la web pública no puede quedarse en
   * blanco porque falte una fila.
   */
  static async leer(slug: SlugContenido): Promise<unknown> {
    const fila = await db.contenidoPagina.findUnique({ where: { slug }, select: { datos: true } });
    return fila ? mezclarConDefectos(slug, fila.datos) : porDefecto(slug);
  }

  /**
   * Sustituye el documento entero. Ya viene validado por el esquema de su slug.
   *
   * Cada guardado deja una versión en el historial, con quién la hizo. La
   * primera vez que se guarda una página con historial vacío, lo que había
   * antes entra también como versión: así lo primero que se cambia ya se puede
   * deshacer.
   *
   * Las fotos que salen del documento se borran del disco si ningún otro
   * registro las usa, igual que hace `PortadaService.guardarImagenes`. Las
   * versiones cuentan como registro: una foto quitada sigue en el disco
   * mientras alguna versión del historial la lleve, y se libera cuando esa
   * versión sale de él por antigua.
   */
  static async guardar(slug: SlugContenido, datos: object, autorId?: number): Promise<unknown> {
    const anterior = await db.contenidoPagina.findUnique({ where: { slug }, select: { datos: true } });
    const autor = await autorDe(autorId);

    await db.$transaction(async (tx) => {
      await tx.contenidoPagina.upsert({
        where: { slug },
        update: { datos },
        create: { slug, datos },
      });
      if (anterior && (await tx.versionContenido.count({ where: { slug } })) === 0) {
        await tx.versionContenido.create({ data: { slug, datos: anterior.datos as object, autorId: null, autorNombre: '' } });
      }
      await tx.versionContenido.create({ data: { slug, datos, ...autor } });
    });

    const sobrantes = await db.versionContenido.findMany({
      where: { slug },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: VERSIONES_POR_PAGINA,
      select: { id: true, datos: true },
    });
    if (sobrantes.length > 0) {
      await db.versionContenido.deleteMany({ where: { id: { in: sobrantes.map((v) => v.id) } } });
    }

    await borrarSubidasHuerfanas(
      subidasEnTexto(JSON.stringify(anterior?.datos ?? {}), ...sobrantes.map((v) => JSON.stringify(v.datos))),
      { conservar: subidasEnTexto(JSON.stringify(datos)) },
    );

    return this.leer(slug);
  }

  /** El historial de una página, de la más nueva a la más antigua, sin los documentos. */
  static async versiones(slug: SlugContenido) {
    const filas = await db.versionContenido.findMany({
      where: { slug },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true, autorNombre: true, datos: true },
    });
    return filas.map((fila, indice) => ({
      id: fila.id,
      fecha: fila.createdAt,
      autor: fila.autorNombre,
      // La primera de la lista es lo que está publicado ahora.
      actual: indice === 0,
      ...resumenDe(fila.datos),
    }));
  }

  /**
   * Una versión, mezclada con los valores de partida como cuando se lee la
   * página: si desde entonces la forma cambió, llega con la de ahora. No se
   * restaura aquí: el CMS la carga en el editor y se guarda como un cambio más,
   * con su validación y su propia versión.
   */
  static async version(slug: SlugContenido, id: number): Promise<unknown> {
    const fila = await db.versionContenido.findFirst({ where: { id, slug }, select: { datos: true } });
    if (!fila) throw new NotFoundError('Esa versión no existe');
    return mezclarConDefectos(slug, fila.datos);
  }
}
