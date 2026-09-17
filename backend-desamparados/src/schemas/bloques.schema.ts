import { type } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import type { TipoBloque } from '../domain/bloques.js';

/** Un texto visible, sin `<` ni `>`: se pinta como texto plano. */
const texto = (max: number) => type(`0 <= string <= ${max}`)
  .matching(/^[^<>]*$/)
  .describe(`un texto de hasta ${max} caracteres, sin < ni >`);

const ETIQUETA = texto(topes.etiqueta);
const TITULO = texto(topes.titulo);
const DESCRIPCION = texto(topes.descripcion);
const sinFoto = type('string').matching(/^$/);

/**
 * Enlace de una tarjeta: solo rutas de este sitio.
 *
 * Empieza por una barra y NO por dos: `//otro.test` es relativo al protocolo,
 * parece interno y lleva fuera. Tampoco `javascript:` ni ningún esquema.
 */
const enlaceInterno = type('string <= 200')
  .matching(/^\/(?!\/)[A-Za-z0-9\-._~/]*$/)
  .describe('una ruta de este sitio, como /corporacion/historia');

/**
 * El título de sección es común a todos los bloques y opcional: vacío significa
 * que el bloque no lleva encabezado. Evita tener un bloque «título suelto» que
 * se pueda quedar huérfano al reordenar.
 */
const comunes = { titulo: TITULO };

const textoSchema = type({
  ...comunes,
  tipo: "'texto'",
  // El HTML ya viene saneado por sanear-html.ts; aquí solo se exige que haya algo.
  html: type('1 <= string <= 20000'),
});

const fotoSchema = type({
  ...comunes,
  tipo: "'foto'",
  url: rutaImagenPublica,
  alt: DESCRIPCION,
  pie: ETIQUETA,
}).narrow((datos, ctx) => datos.alt.trim() !== ''
  ? true
  // Sin descripción, la foto no existe para quien use un lector de pantalla.
  : ctx.reject({ path: ['alt'], problem: 'es obligatoria: describe lo que se ve' }));

const tarjetaSchema = type({
  titulo: TITULO,
  descripcion: DESCRIPCION,
  enlace: enlaceInterno,
});

const tarjetasSchema = type({
  ...comunes,
  tipo: "'tarjetas'",
  tarjetas: tarjetaSchema.array().atLeastLength(1).atMostLength(12),
});

const POR_TIPO = { texto: textoSchema, foto: fotoSchema, tarjetas: tarjetasSchema } as const;

export const esquemaDeBloque = (tipo: TipoBloque) => POR_TIPO[tipo as keyof typeof POR_TIPO];

/** La cabecera de la página. Está siempre y no se puede quitar. */
export const cabeceraSchema = type({
  titulo: TITULO,
  subtitulo: DESCRIPCION,
  foto: sinFoto.or(rutaImagenPublica),
  fotoAlt: DESCRIPCION,
}).narrow((datos, ctx) => datos.foto === '' || datos.fotoAlt.trim() !== ''
  ? true
  // Misma regla que el plano del recorrido y las fotos de los hitos: en cuanto
  // hay foto, su descripción deja de ser opcional.
  : ctx.reject({ path: ['fotoAlt'], problem: 'es obligatoria cuando hay foto' }));
