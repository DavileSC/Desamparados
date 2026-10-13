import db from '../../src/config/db.js';
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

/**
 * Da a una salida a mano una fecha de prueba dentro de `dias` días (un acto
 * suyo en la Agenda) y devuelve cómo dejarla como estaba. Sin próxima fecha
 * no se pide papeleta, ni en el área ni en la mesa, y en la base nueva del CI
 * el Rosario no tiene acto: la prueba que pide para él le pone uno.
 */
export async function conFechaDePrueba(slug: string, dias = 30): Promise<() => Promise<void>> {
  const s = await salida(slug);
  const previo = s.eventoId;
  const acto = await db.evento.create({
    data: { title: s.nombre, type: 'PROCESION', startDate: new Date(Date.now() + dias * 24 * 60 * 60 * 1000) },
  });
  await db.salida.update({ where: { id: s.id }, data: { eventoId: acto.id } });
  return async () => {
    await db.salida.update({ where: { id: s.id }, data: { eventoId: previo } });
    await db.evento.deleteMany({ where: { id: acto.id } });
  };
}
