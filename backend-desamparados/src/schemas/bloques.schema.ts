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
  // El HTML llega saneado: la ruta pasa el documento por `sanearBloques`
  // (utils/sanear-html.ts) ANTES de validarlo. Aquí solo se exige que, después
  // de esa limpieza, quede algo que pintar.
  html: type(`1 <= string <= ${topes.html}`),
}).narrow((datos, ctx) => datos.html.trim() !== ''
  ? true
  // Tres espacios no son un párrafo: el bloque pintaría un hueco en la página.
  // El tope de arriba ya descarta la cadena vacía, pero no el blanco. El CMS
  // avisa de lo mismo (`problemaDeBloque`), y esa comprobación vive solo en el
  // navegador.
  : ctx.reject({ path: ['html'], problem: 'no puede quedar en blanco' }));

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
  // El tope sale del JSON compartido porque el CMS también lo necesita: es él
  // quien deshabilita «Añadir tarjeta» al llegar al límite, y con dos números
  // escritos aparte se separan sin que nadie lo note.
  tarjetas: tarjetaSchema.array().atLeastLength(1).atMostLength(topes.tarjetasPorBloque),
}).narrow((datos, ctx) => {
  // Una tarjeta sin título es un recuadro vacío que lleva a alguna parte: no
  // dice adónde ni por qué pulsarla. Misma regla que una foto sin descripción
  // (fotoSchema): en cuanto hay contenido, el título deja de ser opcional. El
  // enlace no entra aquí: «/» (la portada) es un destino legítimo.
  const indice = datos.tarjetas.findIndex((tarjeta) => tarjeta.titulo.trim() === '');
  return indice === -1
    ? true
    : ctx.reject({ path: ['tarjetas', indice, 'titulo'], problem: 'no puede quedar en blanco' });
});

const POR_TIPO = { texto: textoSchema, foto: fotoSchema, tarjetas: tarjetasSchema } as const;

export const esquemaDeBloque = (tipo: TipoBloque) => POR_TIPO[tipo as keyof typeof POR_TIPO];

/** La cabecera de la página. Está siempre y no se puede quitar. */
export const cabeceraSchema = type({
  titulo: TITULO,
  subtitulo: DESCRIPCION,
  foto: sinFoto.or(rutaImagenPublica),
  fotoAlt: DESCRIPCION,
}).narrow((datos, ctx) => {
  // Un título en blanco (o solo espacios: tres espacios no son un título) deja
  // la página sin título en producción. El CMS ya avisa antes de mandar nada,
  // pero esa comprobación vive solo en el navegador; sin esta, un PUT hecho a
  // mano se colaba igual.
  if (datos.titulo.trim() === '') return ctx.reject({ path: ['titulo'], problem: 'no puede quedar en blanco' });
  return datos.foto === '' || datos.fotoAlt.trim() !== ''
    ? true
    // Misma regla que el plano del recorrido y las fotos de los hitos: en cuanto
    // hay foto, su descripción deja de ser opcional.
    : ctx.reject({ path: ['fotoAlt'], problem: 'es obligatoria cuando hay foto' });
});
