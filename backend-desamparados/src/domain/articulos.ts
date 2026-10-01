import { identidad as deEstaInstalacion, type Articulo } from './datos-entidad.js';

export type { Articulo };

/**
 * El artículo de la corporación o de una salida, y las frases que salen de él.
 * Se guarda el artículo y no el género porque hay corporaciones y salidas en
 * plural (las Cofradías Fusionadas, los Santos Oficios). En castellano solo se
 * contraen «de el» y «a el»: con eso basta para no escribir nunca «del Grupo»
 * a mano. La misma copia vive en desamparados-web/src/domain/articulos.ts.
 */
export const ARTICULOS: readonly Articulo[] = ['el', 'la', 'los', 'las'];

/** El artículo de una fila de Salida: la columna es un VARCHAR(3) sin enum (Prisma no conoce el tipo), y solo entra por el esquema de las salidas, que lo limita a los cuatro. */
export const articuloDe = (s: { articulo: string }): Articulo => s.articulo as Articulo;

export const conArticulo = (art: Articulo, nombre: string) => `${art} ${nombre}`;
export const deArticulo = (art: Articulo, nombre: string) => (art === 'el' ? `del ${nombre}` : `de ${art} ${nombre}`);
export const aArticulo = (art: Articulo, nombre: string) => (art === 'el' ? `al ${nombre}` : `a ${art} ${nombre}`);
export const nuestro = (art: Articulo) => ({ el: 'nuestro', la: 'nuestra', los: 'nuestros', las: 'nuestras' })[art];
export const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

interface OpcionesCorporacion {
  /** «el Grupo» en vez de «el Grupo Parroquial», dentro de un texto ya situado. */
  corto?: boolean;
  /** Otra instalación: para las pruebas. */
  identidad?: { articulo: Articulo; tipo: string; tipoCorto: string };
}

const partes = ({ corto = false, identidad = deEstaInstalacion }: OpcionesCorporacion = {}) =>
  [identidad.articulo, corto ? identidad.tipoCorto : identidad.tipo] as const;

export const laCorporacion = (o?: OpcionesCorporacion) => conArticulo(...partes(o));
export const deLaCorporacion = (o?: OpcionesCorporacion) => deArticulo(...partes(o));
export const aLaCorporacion = (o?: OpcionesCorporacion) => aArticulo(...partes(o));
export const nuestraCorporacion = (o?: OpcionesCorporacion) => {
  const [art, nombre] = partes(o);
  return `${nuestro(art)} ${nombre}`;
};
