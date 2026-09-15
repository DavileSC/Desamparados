import { type } from 'arktype';
import { rutaImagenPublica } from './portada.schema.js';
import type { SlugContenido } from '../domain/contenido.js';

/**
 * Un texto visible de la web. Sin `<` ni `>`: estos campos se pintan como texto
 * plano dentro de componentes de MUI, y prohibir las etiquetas aquí evita que
 * el día que alguien los pinte como HTML se convierta en XSS almacenado.
 */
const texto = (max: number) => type(`0 <= string <= ${max}`)
  .matching(/^[^<>]*$/)
  .describe(`un texto de hasta ${max} caracteres, sin < ni >`);

const TITULO = texto(120);
const PARRAFO = texto(600);
const ETIQUETA = texto(60);

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
    imagenAlt: texto(200),
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
  plano: { url: type('string').matching(/^$/).or(rutaImagenPublica), alt: texto(200) },
  paradas: type({ hora, lugar: texto(200) }).array().atMostLength(60),
}).narrow((datos, ctx) =>
  datos.plano.url === '' || datos.plano.alt.trim() !== ''
    ? true
    // Un plano sin descripción deja sin recorrido a quien use lector de pantalla.
    : ctx.reject({ path: ['plano', 'alt'], problem: 'es obligatorio cuando hay un plano' })
);

const ESQUEMAS = { portada: portadaSchema, recorrido: recorridoSchema } as const;

/** El esquema del documento de una página, para validarlo suelto. */
export const esquemaDeSlug = (slug: SlugContenido) => ESQUEMAS[slug];

/** Para el middleware `validate`: el documento viaja en `body.datos`. */
export const guardarContenidoSchema = (slug: SlugContenido) =>
  type({ body: { datos: ESQUEMAS[slug] } });
