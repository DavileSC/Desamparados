import { SalidasService, type SalidaConActo } from '../../src/services/procesion/salidas.service.js';
import { conceptoDeSalida } from '../../src/domain/salidas.js';
import { aArticulo, articuloDe, deArticulo } from '../../src/domain/articulos.js';

/** Los slugs de las dos salidas que crean la migración y la siembra. */
export const PASION = 'sabado-de-pasion';
export const ROSARIO = 'rosario-vespertino';

/** La fila de una salida, como la reciben los servicios. */
export const salida = (slug: string = PASION): Promise<SalidaConActo> => SalidasService.porSlug(slug);

/** Su id, para crear filas de prueba con `salidaId`. */
export const idDeSalida = async (slug: string = PASION): Promise<number> => (await salida(slug)).id;

/**
 * El concepto del recibo de una salida, calculado como lo hace el código. Las
 * pruebas no escriben el nombre a mano: en una base nueva (el CI) la migración
 * `salidas_neutras_en_base_nueva` las renombra, y en la de desarrollo no.
 */
export const conceptoDe = async (slug: string, year: number): Promise<string> =>
  conceptoDeSalida(await salida(slug), year, []);

/** «del Sábado de Pasión», «de la Estación de penitencia»…, según su artículo. */
export const deLaSalida = async (slug: string): Promise<string> => {
  const s = await salida(slug);
  return deArticulo(articuloDe(s), s.nombre);
};

/** «al Rosario vespertino», «a la Estación de penitencia»… */
export const aLaSalida = async (slug: string): Promise<string> => {
  const s = await salida(slug);
  return aArticulo(articuloDe(s), s.nombre);
};

/** Un texto cualquiera dentro de una expresión regular, sin que sus signos cuenten. */
export const literal = (texto: string): RegExp => new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
