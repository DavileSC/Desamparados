import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArkErrors } from 'arktype';
import { sinBom } from '../../../shared/datos-entidad.mjs';
import db from '../config/db.js';
import { CLAVES_RETIRADAS, esSlugContenido, mezclarConDefectos, porDefecto, SLUGS_CONTENIDO, type SlugContenido } from './contenido.js';
import { esquemaDeSlug } from '../schemas/contenido.schema.js';
import { sanearBloques } from '../utils/sanear-html.js';

/**
 * El contenido con el que nace la web de ESTA instalación.
 *
 * El de partida (shared/contenido-por-defecto.json) es neutro: vale para
 * cualquier corporación y no nombra a ninguna. Lo propio de una —sus textos,
 * su itinerario, sus fotos— puede traerse escrito en
 * instalacion/contenido-inicial.json, fuera de git como datos-entidad.json, y
 * con él se crean las páginas que aún no existan en la base. Es opcional y
 * puede traer solo algunas páginas: las que no, nacen con el neutro.
 *
 * Solo cuenta la primera vez: una página que ya tiene fila no se toca nunca
 * (como el contacto o los módulos, desde entonces manda la base). Por eso una
 * instalación que ya tiene su contenido, como la de Desamparados en el VPS,
 * no necesita el fichero.
 */

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const RUTA_CONTENIDO_INICIAL = 'instalacion/contenido-inicial.json';

// NODE_TEST_CONTEXT lo pone el ejecutor de pruebas de Node; VITEST, Vitest
// (como en shared/datos-entidad.mjs y shared/marca.mjs).
const enPruebas = (entorno: NodeJS.ProcessEnv) => Boolean(entorno.NODE_TEST_CONTEXT || entorno.VITEST);

/**
 * La ruta absoluta de la semilla, o null si no hay.
 *
 * En las pruebas no se lee la de esta máquina: con la de Desamparados en el
 * PC, una base de pruebas nueva nacería con sus textos y las pruebas dejarían
 * de ver lo que ve otra instalación. La prueba que quiera una la pide con
 * `CONTENIDO_INICIAL_DE_PRUEBA` (relativa a la raíz del repositorio), que solo
 * se mira en las pruebas y que, si apunta a un fichero que no existe, lanza:
 * un error de escritura no puede convertirse en «sin semilla» sin avisar.
 */
export function rutaDeContenidoInicial(entorno: NodeJS.ProcessEnv = process.env): string | null {
  if (enPruebas(entorno)) {
    const pedida = entorno.CONTENIDO_INICIAL_DE_PRUEBA?.trim();
    if (!pedida) return null;
    const ruta = resolve(raiz, pedida);
    if (!existsSync(ruta)) throw new Error(`CONTENIDO_INICIAL_DE_PRUEBA apunta a ${ruta}, que no existe.`);
    return ruta;
  }
  const ruta = resolve(raiz, RUTA_CONTENIDO_INICIAL);
  return existsSync(ruta) ? ruta : null;
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Lo que `mezclarConDefectos` tiraría sin decir nada: claves que el de
 * partida no tiene y valores de otro tipo. En una edición del CMS no pasa
 * (el formulario manda la forma buena); en un fichero escrito a mano, una
 * errata en una clave dejaría la página con el texto neutro y nadie sabría
 * por qué. Mejor no arrancar y decirlo.
 */
function loQueSePerderia(defecto: unknown, semilla: unknown, ruta: string): string[] {
  if (!esObjeto(defecto) || !esObjeto(semilla)) return [];
  const problemas: string[] = [];
  for (const [clave, valor] of Object.entries(semilla)) {
    const aqui = `${ruta}.${clave}`;
    if (!(clave in defecto)) {
      // Una retirada se tira al mezclar, como al leer lo guardado: no es una errata.
      if (!CLAVES_RETIRADAS.has(aqui)) problemas.push(`${aqui}: no existe en el contenido de partida`);
      continue;
    }
    const base = defecto[clave];
    if (clave === 'teselas' && Array.isArray(base) && Array.isArray(valor)) {
      // Las teselas se casan por `clave`: una que no esté en el de partida no se pinta.
      const claves = new Set(base.filter(esObjeto).map((t) => t.clave));
      valor.forEach((t, i) => {
        if (!esObjeto(t) || !claves.has(t.clave)) problemas.push(`${aqui}[${i}]: no es ninguna tesela (las que hay: ${[...claves].join(', ')})`);
        else problemas.push(...loQueSePerderia(base.find((b) => esObjeto(b) && b.clave === t.clave), t, `${aqui}[${i}]`));
      });
    } else if (Array.isArray(base)) {
      if (!Array.isArray(valor)) problemas.push(`${aqui}: tiene que ser una lista`);
    } else if (esObjeto(base)) {
      if (!esObjeto(valor)) problemas.push(`${aqui}: tiene que ser un objeto`);
      else problemas.push(...loQueSePerderia(base, valor, aqui));
    } else if (typeof valor !== typeof base) {
      problemas.push(`${aqui}: tiene que ser ${typeof base === 'string' ? 'un texto' : typeof base === 'number' ? 'un número' : `de tipo ${typeof base}`}`);
    }
  }
  return problemas;
}

export type ContenidoInicial = ReadonlyMap<SlugContenido, unknown>;

/**
 * Valida una semilla ya leída y devuelve, por página, el documento que se
 * guardaría: lo de la semilla mezclado sobre el neutro y saneado como un
 * guardado del CMS (el HTML y las direcciones de vídeo, `sanearBloques`).
 * Lanza con todos los problemas a la vez, para corregirlos de una pasada.
 */
export function validarContenidoInicial(crudo: unknown, origen = RUTA_CONTENIDO_INICIAL): ContenidoInicial {
  if (!esObjeto(crudo)) throw new Error(`${origen} tiene que ser un objeto con una clave por página («portada», «historia»…).`);
  const errores: string[] = [];
  const documentos = new Map<SlugContenido, unknown>();
  for (const [slug, documento] of Object.entries(crudo)) {
    if (!esSlugContenido(slug)) {
      errores.push(`«${slug}» no es ninguna página. Las que hay: ${SLUGS_CONTENIDO.join(', ')}.`);
      continue;
    }
    const perdidas = loQueSePerderia(porDefecto(slug), documento, slug);
    if (perdidas.length) { errores.push(...perdidas); continue; }
    const mezclado = mezclarConDefectos(slug, sanearBloques(documento));
    const salida = esquemaDeSlug(slug)(mezclado);
    if (salida instanceof ArkErrors) { errores.push(`${slug}: ${salida.summary}`); continue; }
    documentos.set(slug, mezclado);
  }
  if (errores.length) {
    const cuantos = errores.length === 1 ? 'un problema' : `${errores.length} problemas`;
    throw new Error(`${origen} tiene ${cuantos}:\n${errores.map((e) => `  - ${e}`).join('\n')}`);
  }
  return documentos;
}

/** La semilla de esta instalación (ver `rutaDeContenidoInicial`), validada; vacía si no hay fichero. */
export function leerContenidoInicial(entorno: NodeJS.ProcessEnv = process.env): ContenidoInicial {
  const ruta = rutaDeContenidoInicial(entorno);
  if (!ruta) return new Map();
  let crudo: unknown;
  try {
    crudo = JSON.parse(sinBom(readFileSync(ruta, 'utf8')));
  } catch (error) {
    throw new Error(`${ruta} no es un JSON válido: ${error instanceof Error ? error.message : error}`);
  }
  return validarContenidoInicial(crudo, ruta);
}

/**
 * Crea las filas de `ContenidoPagina` que falten: con la semilla de su página
 * si la trae y, si no, con el neutro. Nunca pisa una que exista, aunque esté
 * a medio editar. Devuelve las que ha creado, para el registro.
 */
export async function sembrarPaginasQueFalten(semilla: ContenidoInicial = leerContenidoInicial()) {
  const existentes = new Set((await db.contenidoPagina.findMany({ select: { slug: true } })).map((f) => f.slug));
  const faltan = SLUGS_CONTENIDO.filter((slug) => !existentes.has(slug));
  if (faltan.length > 0) {
    await db.contenidoPagina.createMany({
      data: faltan.map((slug) => ({ slug, datos: (semilla.get(slug) ?? porDefecto(slug)) as object })),
      // Dos arranques a la vez (o el arranque y la siembra): el segundo no choca.
      skipDuplicates: true,
    });
  }
  return {
    conSemilla: faltan.filter((slug) => semilla.has(slug)),
    neutras: faltan.filter((slug) => !semilla.has(slug)),
  };
}
