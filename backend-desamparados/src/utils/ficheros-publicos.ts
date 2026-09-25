import fs from 'fs/promises';
import path from 'path';
import db from '../config/db.js';
import { publicStorageDir } from '../middleware/upload.middleware.js';

/**
 * Ficheros que sube el CMS a `storage/public` y que dejan de usarse.
 *
 * Antes nunca se borraba nada: quitar una foto, sustituirla o borrar la noticia
 * solo tocaba la base de datos y el archivo seguía publicado en
 * `/storage/public/…` para siempre (con la foto de un menor subida por error,
 * eso es un problema de RGPD, no de espacio en disco).
 *
 * Solo se borra lo que casa EXACTAMENTE con lo que genera la subida del CMS
 * (upload.middleware.ts): 32 caracteres hexadecimales en la raíz de
 * `storage/public`. Nada con subcarpetas, así que los activos del seed
 * (`portada/*.webp`, `documentos/pendiente.pdf`) no se tocan nunca, y nada que
 * no pase ese filtro llega a un `path.join`.
 */
export const RUTA_SUBIDA_PUBLICA = /^\/storage\/public\/([a-f0-9]{32}\.(?:jpg|jpeg|png|webp|pdf))$/i;

/** Las rutas de subida que aparecen dentro de un texto: una URL suelta o el HTML de una noticia. */
const RUTAS_EN_TEXTO = /\/storage\/public\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|pdf)(?![A-Za-z0-9])/gi;

/**
 * El nombre del fichero si la ruta es una subida del CMS; si no, null. Conserva
 * las mayúsculas: las subidas anteriores al arreglo de upload.middleware podían
 * llevar la extensión en mayúsculas («<hex>.JPG») y en Linux es otro fichero.
 */
export function nombreDeSubida(ruta: unknown): string | null {
  if (typeof ruta !== 'string') return null;
  const coincidencia = RUTA_SUBIDA_PUBLICA.exec(ruta);
  return coincidencia ? coincidencia[1] : null;
}

const clave = (nombre: string) => nombre.toLowerCase();

/**
 * Los nombres de fichero subidos que menciona un texto. Sirve igual para un
 * `imagenUrl` que para el HTML de una noticia con fotos incrustadas, y también
 * para URLs absolutas antiguas (`http://…/storage/public/<hex>.jpg`).
 */
export function subidasEnTexto(...textos: (string | null | undefined)[]): Set<string> {
  const nombres = new Set<string>();
  for (const texto of textos) {
    if (!texto) continue;
    for (const [ruta] of texto.matchAll(RUTAS_EN_TEXTO)) {
      const nombre = nombreDeSubida(ruta);
      if (nombre) nombres.add(nombre);
    }
  }
  return nombres;
}

/**
 * Variables de entorno que pueden apuntar a un fichero subido desde el CMS: la
 * normativa que enlazan los correos (email.service.ts) suele ser un PDF subido.
 * Cuentan como «en uso»: si no, sustituir ese PDF en una publicación o pasar
 * `limpiar:huerfanos --borrar` dejaría el enlace de todos los correos muerto.
 */
const VARIABLES_CON_RUTAS = ['NORMATIVA_URL'];
const rutasDelEntorno = () => VARIABLES_CON_RUTAS.map((nombre) => process.env[nombre]);

/**
 * Cuántos registros siguen mencionando el fichero. Se busca por el nombre y no
 * por la ruta exacta: así cuentan también las fotos incrustadas en el HTML y las
 * URLs absolutas que guardaban versiones antiguas del CMS. El nombre es aleatorio
 * de 32 hex, así que no hay falsos positivos que valgan la pena.
 *
 * Es la lista de todos los sitios donde el CMS guarda rutas: si se añade un
 * campo nuevo que apunte a `/storage/public`, tiene que entrar aquí y en
 * `subidasReferenciadas`, o sus ficheros se borrarán estando en uso. El
 * contenido editable ya está contemplado vía `contarEnContenido`: son las filas
 * `portada`, `recorrido` e `historia` (valores de `slug`) de la tabla `ContenidoPagina`, no
 * tablas con esos nombres, que no existen.
 */
export async function contarReferencias(nombre: string): Promise<number> {
  const enEntorno = [...subidasEnTexto(...rutasDelEntorno())].some((n) => clave(n) === clave(nombre));
  if (enEntorno) return 1;
  const menciona = { contains: nombre };
  const cuentas = await Promise.all([
    db.noticia.count({ where: { OR: [{ imagenUrl: menciona }, { contenido: menciona }] } }),
    db.publicacion.count({ where: { OR: [{ imagenUrl: menciona }, { archivoUrl: menciona }, { descripcion: menciona }] } }),
    db.imagenPortada.count({ where: { url: menciona } }),
    db.enser.count({ where: { imagenUrl: menciona } }),
    db.pagina.count({ where: { contenido: menciona } }),
    db.evento.count({ where: { OR: [{ description: menciona }, { fotoCartel: menciona }] } }),
    // El contenido editable guarda rutas de foto dentro de un JSON (la de
    // «Sábado de Pasión», el plano del recorrido, las de la historia). Son pocas filas: se leen
    // enteras y se busca el nombre en su texto, porque el filtro JSON de Prisma
    // sobre MariaDB no es de fiar para un `contains` dentro de un objeto.
    contarEnContenido(nombre),
  ]);
  return cuentas.reduce((total, n) => total + n, 0);
}

async function contarEnContenido(nombre: string): Promise<number> {
  const paginas = await jsonDeContenido();
  // Con `clave()` a los dos lados, como en el resto de la familia: el nombre se
  // compara sin mirar mayúsculas porque las subidas antiguas podían guardar la
  // extensión en mayúsculas y en Linux «<hex>.JPG» y «<hex>.jpg» son ficheros
  // distintos. Siendo esta la cuenta que decide si una foto publicada se borra,
  // un fallo de comparación aquí se paga borrando lo que sigue en uso.
  const mencionados = new Set([...subidasEnTexto(...paginas)].map(clave));
  return mencionados.has(clave(nombre)) ? 1 : 0;
}

/**
 * El texto de todos los JSON del constructor de páginas: los documentos
 * publicados, sus versiones anteriores y las secciones guardadas. Las tres
 * cuentan: una foto que ya no está en la página pero sí en una versión tiene
 * que seguir en el disco, o restaurar esa versión la dejaría rota. Se libera
 * cuando la versión sale del historial (`ContenidoService`).
 */
async function jsonDeContenido(): Promise<string[]> {
  const [paginas, versiones, secciones] = await Promise.all([
    db.contenidoPagina.findMany({ select: { datos: true } }),
    db.versionContenido.findMany({ select: { datos: true } }),
    db.seccionGuardada.findMany({ select: { bloques: true } }),
  ]);
  return [
    ...paginas.map((p) => JSON.stringify(p.datos)),
    ...versiones.map((v) => JSON.stringify(v.datos)),
    ...secciones.map((s) => JSON.stringify(s.bloques)),
  ];
}

/** Todos los ficheros subidos que menciona alguna tabla (para el script de huérfanos). */
export async function subidasReferenciadas(): Promise<Set<string>> {
  const [noticias, publicaciones, portada, enseres, paginas, eventos, contenido] = await Promise.all([
    db.noticia.findMany({ select: { imagenUrl: true, contenido: true } }),
    db.publicacion.findMany({ select: { imagenUrl: true, archivoUrl: true, descripcion: true } }),
    db.imagenPortada.findMany({ select: { url: true } }),
    db.enser.findMany({ select: { imagenUrl: true } }),
    db.pagina.findMany({ select: { contenido: true } }),
    db.evento.findMany({ select: { description: true, fotoCartel: true } }),
    jsonDeContenido(),
  ]);
  const textos = [
    ...noticias.flatMap((n) => [n.imagenUrl, n.contenido]),
    ...publicaciones.flatMap((p) => [p.imagenUrl, p.archivoUrl, p.descripcion]),
    ...portada.map((i) => i.url),
    ...enseres.map((e) => e.imagenUrl),
    ...paginas.map((p) => p.contenido),
    ...eventos.flatMap((e) => [e.description, e.fotoCartel]),
    ...contenido,
    ...rutasDelEntorno(),
  ];
  return subidasEnTexto(...textos);
}

/**
 * Borra un fichero subido del disco. Vuelve a pasar el filtro justo antes del
 * `path.join`: esta función es la única puerta al sistema de ficheros y no se
 * fía de quien la llama. Que el fichero ya no exista no es un error.
 */
export async function borrarSubida(nombre: string, directorio = publicStorageDir): Promise<boolean> {
  const seguro = nombreDeSubida(`/storage/public/${nombre}`);
  if (!seguro || seguro !== nombre) return false;
  try {
    await fs.unlink(path.join(directorio, seguro));
    return true;
  } catch (e: any) {
    if (e?.code === 'ENOENT') return false;
    throw e;
  }
}

/**
 * Tras guardar o borrar un registro: borra del disco los ficheros que tenía
 * antes y que ya no menciona ningún registro. Se llama DESPUÉS de que la base
 * de datos haya confirmado el cambio, con lo que la cuenta ve el estado nuevo.
 *
 * Nunca lanza: la operación del usuario ya está hecha y un fallo del disco no
 * debe convertirla en un 500. Lo que no se pueda borrar lo recoge después
 * `scripts/limpiar-huerfanos.ts`.
 */
export async function borrarSubidasHuerfanas(
  antes: Iterable<string>,
  { conservar = [], directorio = publicStorageDir }: { conservar?: Iterable<string>; directorio?: string } = {},
): Promise<string[]> {
  const siguen = new Set([...conservar].map(clave));
  const vistos = new Set<string>();
  const borrados: string[] = [];
  for (const nombre of antes) {
    if (siguen.has(clave(nombre)) || vistos.has(clave(nombre))) continue;
    vistos.add(clave(nombre));
    try {
      if ((await contarReferencias(nombre)) > 0) continue;
      if (await borrarSubida(nombre, directorio)) borrados.push(nombre);
    } catch (e) {
      console.error(`[Storage] No se ha podido borrar el fichero huérfano ${nombre}:`, e);
    }
  }
  if (borrados.length) console.log(`[Storage] Borrados ${borrados.length} fichero(s) que ya no usa ningún registro.`);
  return borrados;
}

export interface FicheroHuerfano {
  nombre: string;
  bytes: number;
  modificado: Date;
}

/**
 * Los ficheros subidos que hay en la raíz de `storage/public` y que no menciona
 * ningún registro. Deja fuera los recientes (`minHoras`): una foto recién subida
 * no se guarda en la base de datos hasta que el editor pulsa «Guardar», y
 * borrarla mientras rellena el formulario le dejaría una imagen rota.
 *
 * Solo mira la raíz: las subcarpetas son de los activos del seed.
 */
export async function buscarHuerfanos({
  referenciados,
  directorio = publicStorageDir,
  minHoras = 24,
  ahora = new Date(),
}: { referenciados: Set<string>; directorio?: string; minHoras?: number; ahora?: Date }): Promise<{ huerfanos: FicheroHuerfano[]; ignorados: string[] }> {
  const enUso = new Set([...referenciados].map(clave));
  const entradas = await fs.readdir(directorio, { withFileTypes: true });
  const huerfanos: FicheroHuerfano[] = [];
  const ignorados: string[] = [];
  for (const entrada of entradas) {
    if (!entrada.isFile()) continue;
    if (nombreDeSubida(`/storage/public/${entrada.name}`) !== entrada.name) {
      ignorados.push(entrada.name);
      continue;
    }
    if (enUso.has(clave(entrada.name))) continue;
    const datos = await fs.stat(path.join(directorio, entrada.name));
    // La edad nunca es negativa: el mtime del disco puede quedar unos
    // milisegundos por delante del reloj de Node (NTFS lo hace), y entonces la
    // resta salía negativa y el fichero se descartaba por «reciente» aunque se
    // hubiera pedido sin margen (--horas=0 se dejaba subidas sin listar).
    const edadMs = Math.max(0, ahora.getTime() - datos.mtime.getTime());
    if (edadMs < minHoras * 3600_000) continue;
    huerfanos.push({ nombre: entrada.name, bytes: datos.size, modificado: datos.mtime });
  }
  huerfanos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { huerfanos, ignorados };
}
