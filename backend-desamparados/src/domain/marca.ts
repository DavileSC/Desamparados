import { leerMarca, type FicheroMarca, type FicherosMarca } from '../../../shared/marca.mjs';
import { paletaDeImprenta, type PaletaDeImprenta } from '../../../shared/colores-de-marca.mjs';
import { coloresDeMarca } from './datos-entidad.js';

/**
 * La marca de esta instalación en los PDF y en los correos: qué escudo sale en
 * cada sitio, la cabecera de los correos a hermanos y los colores de imprenta.
 *
 * Se resuelve una vez, al importarse, como `datos-entidad.ts`: los ficheros
 * viven en instalacion/marca/ (montada en el contenedor, fuera de git) y el que
 * falta se toma de la marca de partida (shared/marca-de-partida/). Un fichero
 * que está pero no sirve (otro formato, roto, ilegible) lanza aquí y la API no
 * arranca: index.ts lo importa antes que nada para decirlo pronto, y no al
 * imprimir la primera papeleta. Lo que solo es flojo se avisa por consola.
 */
export const FICHEROS_MARCA: FicherosMarca = leerMarca();

/**
 * La ruta de cada imagen, por el fondo sobre el que se pinta. El escudo
 * destacado (el de oro de Desamparados) no tiene partida: sin él, cada sitio
 * toma el escudo que se lee sobre su fondo, no el mismo para los dos.
 */
export const IMAGENES_MARCA: {
  /** Membrete de los correos y pie de los PDF, sobre blanco. */
  escudoSobreClaro: string;
  /** Papeleta, carta, Modelo 182, ficha de patrimonio y participaciones: sobre papel blanco. */
  escudoDestacadoEnPapel: string;
  /** Portada y membrete de los informes: sobre la banda negra. */
  escudoDestacadoEnNegro: string;
  /** Bajo el membrete de los correos a hermanos; sin ella, el correo va sin imagen. */
  correoCabecera: string | null;
} = {
  escudoSobreClaro: FICHEROS_MARCA.escudoSobreClaro.ruta,
  escudoDestacadoEnPapel: (FICHEROS_MARCA.escudoDestacado ?? FICHEROS_MARCA.escudoSobreClaro).ruta,
  escudoDestacadoEnNegro: (FICHEROS_MARCA.escudoDestacado ?? FICHEROS_MARCA.escudoSobreOscuro).ruta,
  correoCabecera: FICHEROS_MARCA.correoCabecera?.ruta ?? null,
};

/** Los colores de los PDF y los correos, derivados de los de la marca. Con la marca a null, los de siempre. */
export const IMPRENTA: Readonly<PaletaDeImprenta> = paletaDeImprenta(coloresDeMarca);

/** Una línea para el registro de arranque: de dónde sale cada imagen que usa la API. */
export function resumenDeLaMarca(): string {
  const usadas: [string, FicheroMarca | null][] = [
    ['escudo sobre claro', FICHEROS_MARCA.escudoSobreClaro],
    ['escudo destacado', FICHEROS_MARCA.escudoDestacado],
    ['cabecera de los correos', FICHEROS_MARCA.correoCabecera],
  ];
  return usadas
    .map(([nombre, f]) => `${nombre}: ${f ? (f.origen === 'instalacion' ? 'de la instalación' : 'de partida') : 'no hay'}`)
    .join(' · ');
}
