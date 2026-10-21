import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { coloresDelFichero, coloresDeMarca, identidad, identidadDelFichero, type IdentidadEditable } from '../domain/datos-entidad.js';
import { aplicarMarca, FICHEROS_MARCA } from '../domain/marca.js';
import { publicStorageDir } from '../middleware/upload.middleware.js';
import { scanBufferClamav } from '../utils/clamd.js';
import { HttpError } from '../utils/error.handle.js';
import { avisosDeMarca } from '../../../shared/colores-de-marca.mjs';
import type { Marca } from '../../../shared/datos-entidad.mjs';
import { publicarInstalacion, urlDeMarca } from '../../../shared/instalacion-publica.mjs';
import { CATALOGO_MARCA, comprobarImagenDeMarca, resolverMarca, rutaDeMarca, type FicherosMarca } from '../../../shared/marca.mjs';
import {
  CLAVES_QUE_SE_SUBEN, escudoQueCabe, ICONOS, iconosDeMarca, prepararImagenDeMarca, type ClaveQueSeSube,
} from '../../../shared/preparar-marca.mjs';

/** La fila de `Configuracion` con la identidad y los colores, en JSON. */
const CLAVE = 'corporacion_marca';
const DESCRIPCION = 'Identidad y colores (Sistema → Datos de la corporación → Identidad y marca)';

/**
 * Las imágenes de la marca de esta instalación, con los nombres fijos del
 * catálogo (shared/marca.mjs). Fuera de `storage/public`: aquí están las que
 * se han subido, y lo que se sirve es la copia de `storage/public/marca/`, que
 * lleva además las de partida de lo que falte. Dentro de `storage/`, así que
 * entra en la copia de seguridad con todo lo subido.
 */
export const carpetaDeLaMarca = () => path.join(process.cwd(), 'storage', 'marca');

interface Guardado { identidad: IdentidadEditable; colores: Marca }

/** Una imagen como la ve la pantalla del CMS. */
export interface ImagenDeLaMarca { url: string; propia: boolean; ancho: number; alto: number; tipo: string }

export interface EstadoDeLaMarca extends Guardado {
  /** El dominio no se cambia desde aquí: se enseña para que se sepa cuál es. */
  dominio: string;
  imagenes: Record<ClaveQueSeSube, ImagenDeLaMarca | null>;
  /** Los cuatro iconos que salen del escudo sobre oscuro. */
  iconos: { favicon32: string; appleTouchIcon: string; icono192: string; icono512: string };
  /** Contraste de los colores y medidas o pesos flojos de las imágenes. No impiden nada. */
  avisos: string[];
}

/** Lo guardado, con lo que falte rellenado desde el fichero: una fila de antes de un dato nuevo no lo deja en `undefined`. */
function completar(guardado: Partial<Guardado>): Guardado {
  // Sin `titular`, que sale de `titulares`: una fila escrita a mano con él no lo cuela.
  const { titular: _titular, ...guardada } = (guardado.identidad ?? {}) as Partial<IdentidadEditable> & { titular?: string };
  return {
    identidad: { ...identidadDelFichero(), ...guardada },
    colores: { ...coloresDelFichero(), ...guardado.colores },
  };
}

let avisosDeImagenes: string[] = [];

/**
 * Las imágenes de storage/marca/, cada una con su respaldo de partida. Un
 * fichero que no sirve (lo tocó alguien a mano en el servidor) no tira la API:
 * se usa el de partida y se dice en el registro. Lo que falta no se avisa: aquí
 * es lo normal, y la pantalla ya enseña cuáles son de partida.
 */
function leerImagenes(): FicherosMarca {
  const { ficheros, errores, avisos } = resolverMarca({ carpeta: carpetaDeLaMarca() });
  for (const error of errores) console.error(`[Marca] ${error}`);
  avisosDeImagenes = avisos.filter((a) => !a.startsWith('Falta ') && !a.startsWith('No hay carpeta'));
  return ficheros;
}

/**
 * La primera vez, las imágenes de instalacion/marca/ que sirvan pasan a
 * storage/marca/. Una que no sirve se queda fuera (y la de partida en su
 * lugar): el arranque ya lo dijo al leerla (domain/marca.ts).
 */
function sembrarImagenes(): void {
  const destino = carpetaDeLaMarca();
  if (existsSync(destino) && readdirSync(destino).length) return;
  mkdirSync(destino, { recursive: true });
  const { ficheros } = resolverMarca({ carpeta: rutaDeMarca() });
  for (const fichero of Object.values(ficheros)) {
    if (fichero?.origen === 'instalacion') copyFileSync(fichero.ruta, path.join(destino, fichero.fichero));
  }
}

/** Sin que nadie lea uno a medias, como los de la web (shared/instalacion-publica.mjs). */
function escribirDeUnaVez(ruta: string, bytes: Buffer): void {
  const temporal = `${ruta}.${process.pid}.tmp`;
  writeFileSync(temporal, bytes);
  renameSync(temporal, ruta);
}

/** La identidad y los colores de ahora, para volver a aplicarlos con otras imágenes. */
function actual(): Guardado {
  const { dominio: _dominio, titular: _titular, ...editable } = structuredClone(identidad);
  return { identidad: editable, colores: { ...coloresDeMarca } };
}

const ficheroDe = (clave: string) => CATALOGO_MARCA.find((e) => e.clave === clave)!.fichero;

/** «escudo-sobre-oscuro.png: mide…» → «Mide…»: en la pantalla ya se ve de qué imagen es. */
const sinNombre = (mensaje: string) => {
  const sin = mensaje.replace(/^[\w.-]+\.(?:png|jpg): /, '');
  return sin.charAt(0).toUpperCase() + sin.slice(1);
};

/**
 * La identidad, los colores y las imágenes de la corporación: en la base y en
 * storage/marca/, editables desde Sistema → Datos de la corporación →
 * «Identidad y marca». La primera vez se siembran del fichero de la instalación
 * y de instalacion/marca/, y desde entonces manda lo de aquí, como con el
 * contacto: cambiar el fichero ya no los toca.
 *
 * Cada cambio se aplica en memoria (correos y PDF) y vuelve a escribir lo que
 * lee la web en storage/public: /instalacion.js, /manifest.json, la cabecera
 * de index.html y /marca/. Sin reiniciar nada.
 */
export class MarcaService {
  /** Lee la base (sembrando si está vacía), lo aplica y escribe lo de la web. Al arrancar. */
  static async cargar(): Promise<void> {
    const fila = await db.configuracion.findUnique({ where: { key: CLAVE } });
    let guardado: Guardado;
    if (fila) {
      try { guardado = completar(JSON.parse(fila.value) as Partial<Guardado>); }
      catch {
        console.error(`[Marca] La fila ${CLAVE} no es un JSON válido: se usan la identidad y los colores del fichero.`);
        guardado = completar({});
      }
      const delFichero = completar({});
      if (JSON.stringify(delFichero) !== JSON.stringify(guardado)) {
        console.log('[Marca] La identidad o los colores del fichero de la instalación no son los guardados: mandan los del CMS.');
      }
    } else {
      guardado = completar({});
      sembrarImagenes();
      // `upsert` y no `create`: dos arranques a la vez no chocan.
      await db.configuracion.upsert({
        where: { key: CLAVE }, update: {},
        create: { key: CLAVE, value: JSON.stringify(guardado), descripcion: DESCRIPCION },
      });
    }
    MarcaService.aplicar(guardado);
  }

  /** Lo de ahora, como lo enseña la pantalla. */
  static estado(): EstadoDeLaMarca {
    const imagen = (clave: ClaveQueSeSube): ImagenDeLaMarca | null => {
      const f = FICHEROS_MARCA[clave];
      return f && { url: urlDeMarca(f), propia: f.origen === 'instalacion', ancho: f.ancho, alto: f.alto, tipo: f.tipo };
    };
    return {
      ...actual(),
      dominio: identidad.dominio,
      imagenes: Object.fromEntries(CLAVES_QUE_SE_SUBEN.map((c) => [c, imagen(c)])) as EstadoDeLaMarca['imagenes'],
      iconos: {
        favicon32: urlDeMarca(FICHEROS_MARCA.favicon32),
        appleTouchIcon: urlDeMarca(FICHEROS_MARCA.appleTouchIcon),
        icono192: urlDeMarca(FICHEROS_MARCA.icono192),
        icono512: urlDeMarca(FICHEROS_MARCA.icono512),
      },
      avisos: [...avisosDeMarca(coloresDeMarca), ...avisosDeImagenes.map(sinNombre)],
    };
  }

  static async guardar(nuevo: Guardado, meta: MetaDeAuditoria): Promise<EstadoDeLaMarca> {
    const antes = actual();
    const guardado = completar(nuevo);
    await db.configuracion.upsert({
      where: { key: CLAVE },
      update: { value: JSON.stringify(guardado) },
      create: { key: CLAVE, value: JSON.stringify(guardado), descripcion: DESCRIPCION },
    });
    MarcaService.aplicar(guardado);
    await AuditoriaService.log(ACCIONES_AUDITORIA.MARCA_ACTUALIZAR, meta, 'config', CLAVE,
      JSON.parse(JSON.stringify({ antes, despues: guardado })));
    return MarcaService.estado();
  }

  /**
   * Una imagen nueva: cualquier PNG, JPEG o WebP, que se pasa al formato y la
   * medida de su sitio (shared/preparar-marca.mjs) y se comprueba con las
   * reglas de siempre. Con el escudo sobre oscuro salen también los iconos, del
   * original y no del reducido: el de 512 lo pide más grande.
   */
  static async subir(clave: ClaveQueSeSube, original: Buffer, meta: MetaDeAuditoria): Promise<EstadoDeLaMarca> {
    const antivirus = await scanBufferClamav(original);
    if (antivirus.veredicto === 'infectado') {
      console.error(`[Security] Imagen de la marca RECHAZADA por el antivirus (${antivirus.reason})`);
      throw new HttpError('El archivo ha sido rechazado por el análisis antivirus.', 400);
    }
    if (antivirus.veredicto === 'no-disponible') {
      throw new HttpError('El análisis antivirus no está disponible, inténtalo más tarde.', 503);
    }

    let preparada: Buffer;
    try { preparada = await prepararImagenDeMarca(sharp, clave, original); }
    catch { throw new HttpError('No se puede leer como imagen: tiene que ser un PNG, un JPEG o un WebP.', 400); }
    const { errores } = comprobarImagenDeMarca(clave, preparada);
    if (errores.length) throw new HttpError(errores.map(sinNombre).join(' '), 400);
    const iconos = clave === 'escudoSobreOscuro' ? await iconosDeMarca(sharp, escudoQueCabe(sharp, original)) : [];

    const carpeta = carpetaDeLaMarca();
    mkdirSync(carpeta, { recursive: true });
    // Los iconos antes que el escudo: si algo falla a medias, al menos no
    // queda un escudo nuevo con los iconos del anterior.
    for (const icono of iconos) escribirDeUnaVez(path.join(carpeta, icono.fichero), icono.bytes);
    escribirDeUnaVez(path.join(carpeta, ficheroDe(clave)), preparada);
    MarcaService.aplicar(actual());
    await AuditoriaService.log(ACCIONES_AUDITORIA.MARCA_ACTUALIZAR, meta, 'config', CLAVE, { imagen: clave, subida: true });
    return MarcaService.estado();
  }

  /** Vuelve a la de partida, o a ninguna en las que no la tienen. Con el escudo sobre oscuro, también los iconos. */
  static async quitar(clave: ClaveQueSeSube, meta: MetaDeAuditoria): Promise<EstadoDeLaMarca> {
    const carpeta = carpetaDeLaMarca();
    const ficheros = [ficheroDe(clave), ...(clave === 'escudoSobreOscuro' ? ICONOS.map((i) => i.fichero) : [])];
    for (const fichero of ficheros) rmSync(path.join(carpeta, fichero), { force: true });
    MarcaService.aplicar(actual());
    await AuditoriaService.log(ACCIONES_AUDITORIA.MARCA_ACTUALIZAR, meta, 'config', CLAVE, { imagen: clave, quitada: true });
    return MarcaService.estado();
  }

  /** A la memoria y a storage/public. */
  private static aplicar(guardado: Guardado): void {
    const ficheros = leerImagenes();
    aplicarMarca({ identidad: guardado.identidad, colores: guardado.colores, ficheros });
    publicarInstalacion(publicStorageDir, { identidad: structuredClone(identidad), marca: { ...coloresDeMarca } }, FICHEROS_MARCA);
  }
}
