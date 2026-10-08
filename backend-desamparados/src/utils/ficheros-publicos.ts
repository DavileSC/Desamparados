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
export const RUTA_SUBIDA_PUBLICA = /^\/storage\/public\/([a-f0-9]{32}\.(?:jpg|jpeg|png|webp|pdf|mp4))$/i;

/** Las rutas de subida que aparecen dentro de un texto: una URL suelta o el HTML de una noticia. */
const RUTAS_EN_TEXTO = /\/storage\/public\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|pdf|mp4)(?![A-Za-z0-9])/gi;

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

/** Las claves de `Configuracion` del retablo del Inicio: guardan rutas de fotos subidas. */
const PREFIJO_RETABLO = 'inicio_retablo_';
const rutasDelEntorno = () => VARIABLES_CON_RUTAS.map((nombre) => process.env[nombre]);

/** Un `OR` de `contains` para buscar varios nombres en varios campos de una tabla en una sola consulta. */
function mencionaAlguno<C extends string>(campos: readonly C[], nombres: string[]) {
  return { OR: nombres.flatMap((nombre) => campos.map((campo) => ({ [campo]: { contains: nombre } }) as { [K in C]?: { contains: string } })) };
}

/**
 * Cuáles de los ficheros siguen mencionados por algún registro (devuelve sus
 * nombres en minúsculas). Se busca por el nombre y no por la ruta exacta: así
 * cuentan también las fotos incrustadas en el HTML y las URLs absolutas que
 * guardaban versiones antiguas del CMS. El nombre es aleatorio de 32 hex, así
 * que no hay falsos positivos que valgan la pena.
 *
 * Todos los candidatos van juntos: antes se preguntaba uno a uno, y cada uno
 * volvía a leer el contenido entero (páginas, versiones y secciones, con su
 * JSON) y a lanzar una consulta por tabla. Guardar una página con veinte fotos
 * eran veinte lecturas de todo el historial. Ahora el JSON se lee una vez y
 * cada tabla responde a una sola consulta con todos los nombres.
 *
 * Es la lista de todos los sitios donde el CMS guarda rutas: si se añade un
 * campo nuevo que apunte a `/storage/public`, tiene que entrar aquí y en
 * `subidasReferenciadas`, o sus ficheros se borrarán estando en uso. El
 * contenido editable va por `jsonDeContenido`: son las filas `portada`,
 * `recorrido`, `historia`… (valores de `slug`) de la tabla `ContenidoPagina`.
 */
export async function subidasEnUso(nombres: Iterable<string>): Promise<Set<string>> {
  const candidatos = [...new Set([...nombres].map(clave))];
  const enUso = new Set<string>();
  if (candidatos.length === 0) return enUso;

  // Las del entorno, en minúsculas como todo lo demás.
  for (const n of subidasEnTexto(...rutasDelEntorno())) enUso.add(clave(n));

  // La consulta solo filtra; quién menciona a quién se decide aquí, con el
  // texto en minúsculas: es lo mismo que hacía el `contains` de antes (la
  // colación de MariaDB no distingue mayúsculas), sin fiarse de la colación.
  const marcar = (...textos: (string | null | undefined)[]) => {
    const texto = textos.filter(Boolean).join(' ').toLowerCase();
    if (!texto) return;
    for (const c of candidatos) if (texto.includes(c)) enUso.add(c);
  };

  const [noticias, publicaciones, portada, enseres, paginas, eventos, retablo, productos, campanas, contenido] = await Promise.all([
    db.noticia.findMany({ where: mencionaAlguno(['imagenUrl', 'contenido'], candidatos), select: { imagenUrl: true, contenido: true } }),
    db.publicacion.findMany({ where: mencionaAlguno(['imagenUrl', 'archivoUrl', 'descripcion'], candidatos), select: { imagenUrl: true, archivoUrl: true, descripcion: true } }),
    db.imagenPortada.findMany({ where: mencionaAlguno(['url'], candidatos), select: { url: true } }),
    // Las galerías (`fotos`) son JSON y el filtro JSON de Prisma sobre MariaDB
    // no es de fiar para un `contains`: son pocas filas y se leen enteras.
    db.enser.findMany({ select: { imagenUrl: true, fotos: true } }),
    db.pagina.findMany({ where: mencionaAlguno(['contenido'], candidatos), select: { contenido: true } }),
    db.evento.findMany({ where: mencionaAlguno(['description', 'fotoCartel'], candidatos), select: { description: true, fotoCartel: true } }),
    // Las fotos del retablo del Inicio del CMS: la de todo el año y las de
    // cada tiempo (estas, dentro de un JSON guardado como texto).
    db.configuracion.findMany({ where: { key: { startsWith: PREFIJO_RETABLO }, ...mencionaAlguno(['value'], candidatos) }, select: { value: true } }),
    // La tienda y los apadrinamientos también suben fotos. Antes solo los
    // miraba el script de huérfanos: una foto de noticia reutilizada en un
    // producto se borraba al quitarla de la noticia.
    db.producto.findMany({ select: { foto: true, fotos: true } }),
    db.campanaApadrinamiento.findMany({ where: mencionaAlguno(['foto'], candidatos), select: { foto: true } }),
    // El contenido editable guarda rutas de foto dentro de un JSON (la de
    // «Sábado de Pasión», el plano del recorrido, las de la historia).
    jsonDeContenido(),
  ]);

  for (const n of noticias) marcar(n.imagenUrl, n.contenido);
  for (const p of publicaciones) marcar(p.imagenUrl, p.archivoUrl, p.descripcion);
  for (const i of portada) marcar(i.url);
  for (const e of enseres) marcar(e.imagenUrl, e.fotos ? JSON.stringify(e.fotos) : null);
  for (const p of paginas) marcar(p.contenido);
  for (const e of eventos) marcar(e.description, e.fotoCartel);
  for (const r of retablo) marcar(r.value);
  for (const p of productos) marcar(p.foto, p.fotos ? JSON.stringify(p.fotos) : null);
  for (const c of campanas) marcar(c.foto);
  // En el JSON del constructor cuenta solo lo que tiene forma de ruta de
  // subida, como siempre; con `clave()` a los dos lados, porque en Linux
  // «<hex>.JPG» y «<hex>.jpg» son ficheros distintos y un fallo de
  // comparación aquí se paga borrando lo que sigue en uso.
  for (const n of subidasEnTexto(...contenido)) enUso.add(clave(n));

  return new Set(candidatos.filter((c) => enUso.has(c)));
}

/** Cuántos registros siguen mencionando el fichero: 1 si alguno, 0 si ninguno. */
export async function contarReferencias(nombre: string): Promise<number> {
  return (await subidasEnUso([nombre])).size;
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
  const [noticias, publicaciones, portada, enseres, paginas, eventos, contenido, productos, campanas, retablo] = await Promise.all([
    db.noticia.findMany({ select: { imagenUrl: true, contenido: true } }),
    db.publicacion.findMany({ select: { imagenUrl: true, archivoUrl: true, descripcion: true } }),
    db.imagenPortada.findMany({ select: { url: true } }),
    db.enser.findMany({ select: { imagenUrl: true, fotos: true } }),
    db.pagina.findMany({ select: { contenido: true } }),
    db.evento.findMany({ select: { description: true, fotoCartel: true } }),
    jsonDeContenido(),
    // La tienda y los apadrinamientos también suben fotos: sin contarlas, la limpieza las borraba.
    db.producto.findMany({ select: { foto: true, fotos: true } }),
    db.campanaApadrinamiento.findMany({ select: { foto: true } }),
    db.configuracion.findMany({ where: { key: { startsWith: PREFIJO_RETABLO } }, select: { value: true } }),
  ]);
  const textos = [
    ...noticias.flatMap((n) => [n.imagenUrl, n.contenido]),
    ...publicaciones.flatMap((p) => [p.imagenUrl, p.archivoUrl, p.descripcion]),
    ...portada.map((i) => i.url),
    ...enseres.flatMap((e) => [e.imagenUrl, e.fotos ? JSON.stringify(e.fotos) : null]),
    ...paginas.map((p) => p.contenido),
    ...eventos.flatMap((e) => [e.description, e.fotoCartel]),
    ...contenido,
    ...productos.flatMap((p) => [p.foto, p.fotos ? JSON.stringify(p.fotos) : null]),
    ...campanas.map((c) => c.foto),
    ...retablo.map((r) => r.value),
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
  const candidatos: string[] = [];
  for (const nombre of antes) {
    if (siguen.has(clave(nombre)) || vistos.has(clave(nombre))) continue;
    vistos.add(clave(nombre));
    candidatos.push(nombre);
  }
  const borrados: string[] = [];
  if (candidatos.length === 0) return borrados;
  let enUso: Set<string>;
  try {
    enUso = await subidasEnUso(candidatos);
  } catch (e) {
    console.error('[Storage] No se ha podido comprobar qué ficheros siguen en uso; no se borra ninguno:', e);
    return borrados;
  }
  for (const nombre of candidatos) {
    if (enUso.has(clave(nombre))) continue;
    try {
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
