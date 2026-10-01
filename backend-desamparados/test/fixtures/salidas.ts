import { SalidasService, type SalidaConActo } from '../../src/services/procesion/salidas.service.js';

/** Los slugs de las dos salidas que crean la migración y la siembra. */
export const PASION = 'sabado-de-pasion';
export const ROSARIO = 'rosario-vespertino';

/** La fila de una salida, como la reciben los servicios. */
export const salida = (slug: string = PASION): Promise<SalidaConActo> => SalidasService.porSlug(slug);

/** Su id, para crear filas de prueba con `salidaId`. */
export const idDeSalida = async (slug: string = PASION): Promise<number> => (await salida(slug)).id;
