import { type } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import { esVideoDeGaleria } from '../domain/video-galeria.js';
import { esImagenPropia } from '../utils/rutas-propias.js';
import type { SlugContenido } from '../domain/contenido.js';

/**
 * Un texto visible de la web. Sin `<` ni `>`: estos campos se pintan como texto
 * plano dentro de componentes de MUI, y prohibir las etiquetas aquí evita que
 * el día que alguien los pinte como HTML se convierta en XSS almacenado.
 */
const texto = (max: number) => type(`0 <= string <= ${max}`)
  .matching(/^[^<>]*$/)
  .describe(`un texto de hasta ${max} caracteres, sin < ni >`);

// Los cuatro topes salen de `shared/topes-contenido.json` y no de números
// escritos aquí: las pantallas del CMS repiten estos mismos límites en sus
// `maxLength` para avisar mientras se escribe, y mientras cada lado se los
// inventaba por su cuenta nada impedía que dejaran de coincidir. Los valores
// son los de siempre: 60/120/600/200.
const TITULO = texto(topes.titulo);
const PARRAFO = texto(topes.parrafo);
const ETIQUETA = texto(topes.etiqueta);
const DESCRIPCION = texto(topes.descripcion);

const heroSchema = type({
  ceja: ETIQUETA, titulo: TITULO, parrafo: PARRAFO,
  botonPrincipal: ETIQUETA, enlaceSecundario: ETIQUETA,
});

const portadaSchema = type({
  hero: heroSchema,
  actualidad: { ceja: ETIQUETA, titulo: TITULO, enlace: ETIQUETA },
  agenda: {
    ceja: ETIQUETA, titulo: TITULO, parrafo: PARRAFO, enlace: ETIQUETA,
    directoTitulo: ETIQUETA, directoTexto: ETIQUETA,
  },
  accesos: {
    placa: { ceja: ETIQUETA, titulo: TITULO, texto: PARRAFO, boton: ETIQUETA },
    teselas: type({ clave: ETIQUETA, titulo: TITULO, descripcion: PARRAFO }).array().atMostLength(12),
  },
  sabadoDePasion: {
    ceja: ETIQUETA, titulo: TITULO, parrafo: PARRAFO, enlace: ETIQUETA,
    imagenUrl: rutaImagenPublica,
    imagenAlt: DESCRIPCION,
  },
  publicaciones: { boton: ETIQUETA, marcaDeAgua: ETIQUETA },
});

// La hora se enseña tal cual dentro de la pastilla del itinerario: se exige que
// lo parezca para que nadie meta un párrafo donde caben cinco caracteres.
const hora = type('string').matching(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe('una hora en formato 24 h, como 17:30');

// Con cadena vacía en `url` no hay plano y `alt` puede ir vacío; en cuanto hay
// una ruta, el `alt` deja de ser opcional. La sintaxis de objeto de arktype no
// puede expresar «este campo es obligatorio solo si aquel otro lo está», así
// que la regla vive en el `.narrow` de abajo, no en la forma del tipo.
const recorridoSchema = type({
  titulo: TITULO,
  subtitulo: PARRAFO,
  introduccion: PARRAFO,
  tituloItinerario: TITULO,
  plano: { url: type('string').matching(/^$/).or(rutaImagenPublica), alt: DESCRIPCION },
  // El lugar tiene su propia entrada en `topes-contenido.json`, no la de
  // `descripcion`: es el nombre de una calle o una plaza, y que hoy comparta
  // valor con descripción es casualidad, no un vínculo. Sin tope propio, bajar
  // el de descripción pondría en rojo sin motivo la prueba del CMS que exige
  // que todo maxlength pintado sea un tope que el servidor reconozca.
  paradas: type({ hora, lugar: texto(topes.lugar) }).array().atMostLength(60),
}).narrow((datos, ctx) =>
  datos.plano.url === '' || datos.plano.alt.trim() !== ''
    ? true
    // Un plano sin descripción deja sin recorrido a quien use lector de pantalla.
    : ctx.reject({ path: ['plano', 'alt'], problem: 'es obligatorio cuando hay un plano' })
);

const sinFoto = type('string').matching(/^$/);

// El color de un hito responde a algo de la web, no a un gusto: granate es el
// que ya lleva el Sábado de Pasión y dorado marca el punto en el que estamos,
// como el subrayado del menú. Tres valores cerrados; no un color libre.
const tonoHito = type("'ninguno' | 'granate' | 'oro'");

const hitoSchema = type({
  periodo: ETIQUETA,
  etiqueta: ETIQUETA,
  titulo: TITULO,
  // Un solo cuadro de texto por hito: los párrafos van separados por una línea
  // en blanco, y la web los parte al pintarlos. Tope propio (`relato`) porque
  // caben dos o tres párrafos, más que en `parrafo`.
  relato: texto(topes.relato),
  foto: { url: sinFoto.or(rutaImagenPublica), alt: DESCRIPCION, pie: ETIQUETA },
  tono: tonoHito,
});

/**
 * La página de Historia: cabecera, la foto velada de fondo (opcional: sin
 * ruta, el fondo queda liso; es decorativa y no lleva descripción), los hitos
 * de la cronología en orden y el bloque de cierre. El destino del enlace de
 * cierre lo fija el código, como los de la portada.
 */
const historiaSchema = type({
  ceja: ETIQUETA,
  titulo: TITULO,
  subtitulo: PARRAFO,
  fondo: { url: sinFoto.or(rutaImagenPublica) },
  hitos: hitoSchema.array().atMostLength(30),
  cierre: { ceja: ETIQUETA, titulo: TITULO, enlace: ETIQUETA },
}).narrow((datos, ctx) => {
  // Una foto de hito sin descripción deja ese hito a medias para quien use lector de pantalla.
  const indice = datos.hitos.findIndex((hito) => hito.foto.url !== '' && hito.foto.alt.trim() === '');
  return indice === -1
    ? true
    : ctx.reject({ path: ['hitos', indice, 'foto', 'alt'], problem: 'es obligatorio cuando hay una foto' });
});


// --- Galería de la Sagrada Titular ---

/**
 * Un medio de la galería: una foto nuestra o un vídeo de YouTube/Vimeo.
 *
 * Es un objeto plano con un campo `tipo` y no una unión discriminada a
 * propósito: arktype 2.1 revienta al describir el error de una unión cuyas
 * ramas llevan `narrow` (lo mismo que ya obligó a `updateConfigSchema` a ir por
 * este camino), y eso sería un 500 en vez de un 400. La coherencia entre `tipo`
 * y `url` la comprueba el `.narrow` del documento.
 */
const medioGaleriaSchema = type({
  tipo: "'foto' | 'video'",
  // Una ruta nuestra o una dirección de vídeo ya normalizada: lo estrecha el narrow.
  url: 'string <= 300',
  // Solo para los vídeos: la miniatura que se enseña hasta que alguien pulsa el
  // play. Con ella la web no llama a YouTube mientras nadie se lo pida.
  portada: sinFoto.or(rutaImagenPublica),
  alt: DESCRIPCION,
  pie: ETIQUETA,
});

/** Qué falla en un medio, o `null` si está bien. Devuelve también el campo. */
function problemaDelMedio(medio: { tipo: string; url: string; portada: string; alt: string }): { campo: string; problema: string } | null {
  if (medio.alt.trim() === '') {
    // Sin descripción, la galería no existe para quien use un lector de pantalla.
    return { campo: 'alt', problema: 'es obligatoria: describe lo que se ve' };
  }
  if (medio.tipo === 'foto') {
    return esImagenPropia(medio.url)
      ? null
      : { campo: 'url', problema: 'tiene que ser una foto subida desde el CMS' };
  }
  if (!esVideoDeGaleria(medio.url)) {
    return { campo: 'url', problema: 'tiene que ser un vídeo de YouTube o Vimeo' };
  }
  return medio.portada === ''
    // Sin portada propia habría que pedirle la miniatura a YouTube nada más
    // abrir la página, y eso ya avisa a un tercero de la visita.
    ? { campo: 'portada', problema: 'es obligatoria en los vídeos' }
    : null;
}

/**
 * La página de la Sagrada Titular: su cabecera y la galería que se enseña como
 * pase de fotos y vídeos. Una galería vacía es válida: la sección se oculta.
 */
const titularSchema = type({
  ceja: ETIQUETA,
  titulo: TITULO,
  subtitulo: PARRAFO,
  galeria: medioGaleriaSchema.array().atMostLength(60),
}).narrow((datos, ctx) => {
  for (const [indice, medio] of datos.galeria.entries()) {
    const problema = problemaDelMedio(medio);
    if (problema) return ctx.reject({ path: ['galeria', indice, problema.campo], problem: problema.problema });
  }
  return true;
});

const ESQUEMAS = { portada: portadaSchema, recorrido: recorridoSchema, historia: historiaSchema, titular: titularSchema } as const;

/** El esquema del documento de una página, para validarlo suelto. */
export const esquemaDeSlug = (slug: SlugContenido) => ESQUEMAS[slug];

/** Para el middleware `validate`: el documento viaja en `body.datos`. */
export const guardarContenidoSchema = (slug: SlugContenido) =>
  type({ body: { datos: ESQUEMAS[slug] } });
