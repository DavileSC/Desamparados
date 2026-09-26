import { type } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import type { SlugContenido } from '../domain/contenido.js';
import { cabeceraSchema, problemaDeBloque } from './bloques.schema.js';
import { anclaDe } from '../domain/presentacion.js';

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
const sinFoto = type('string').matching(/^$/);

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
    // La foto velada del fondo del bloque. Vacía, el bloque queda sobre fondo
    // oscuro liso: a diferencia del Sábado de Pasión, aquí la foto es ambiente.
    imagenUrl: sinFoto.or(rutaImagenPublica),
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

/**
 * Una página compuesta de bloques.
 *
 * Los bloques se validan uno a uno con el esquema de su `tipo`, no con una unión
 * discriminada: arktype 2.1 revienta al describir el error de una unión cuyas
 * ramas llevan `narrow`, y eso sería un 500 en vez de un 400.
 *
 * Un tipo desconocido se rechaza nombrándolo. Ignorarlo en silencio haría que un
 * bloque desapareciera al guardar, que es peor que un error.
 */
const paginaDeBloquesSchema = type({
  cabecera: cabeceraSchema,
  bloques: type('unknown[]').atMostLength(40),
}).narrow((datos, ctx) => {
  const anclas = new Map<string, number>();
  for (const [indice, bloque] of datos.bloques.entries()) {
    const problema = problemaDeBloque(bloque);
    if (problema) return ctx.reject({ path: ['bloques', indice, ...problema.path], problem: problema.problem });
    // Dos bloques con la misma ancla: un enlace a `#ancla` solo puede bajar a
    // uno, y el otro se quedaría sin que nadie supiera por qué.
    const ancla = anclaDe(bloque);
    if (ancla !== '') {
      const antes = anclas.get(ancla);
      if (antes !== undefined) {
        return ctx.reject({
          path: ['bloques', indice, 'presentacion', 'ancla'],
          problem: `repite el ancla «${ancla}» del bloque ${antes + 1}`,
        });
      }
      anclas.set(ancla, indice);
    }
  }
  return true;
});

const ESQUEMAS = {
  portada: portadaSchema,
  // Las páginas por bloques comparten esquema: lo que las distingue es su
  // documento, no su forma. Se escriben una a una y no con un bucle sobre el
  // catálogo para que el tipo de `esquemaDeSlug` siga siendo comprobable.
  historia: paginaDeBloquesSchema,
  recorrido: paginaDeBloquesSchema,
  parroquia: paginaDeBloquesSchema,
  'organos-de-gobierno': paginaDeBloquesSchema,
  'nuestros-fines': paginaDeBloquesSchema,
  caridad: paginaDeBloquesSchema,
  formacion: paginaDeBloquesSchema,
  cultos: paginaDeBloquesSchema,
  'sabado-de-pasion': paginaDeBloquesSchema,
  trono: paginaDeBloquesSchema,
  enseres: paginaDeBloquesSchema,
  desamparados: paginaDeBloquesSchema,
  ajuar: paginaDeBloquesSchema,
  agenda: paginaDeBloquesSchema,
  noticias: paginaDeBloquesSchema,
  publicaciones: paginaDeBloquesSchema,
  boletines: paginaDeBloquesSchema,
  'dossier-prensa': paginaDeBloquesSchema,
  contacto: paginaDeBloquesSchema,
} as const;

/** El esquema del documento de una página, para validarlo suelto. */
export const esquemaDeSlug = (slug: SlugContenido) => ESQUEMAS[slug];

/** Para el middleware `validate`: el documento viaja en `body.datos`. */
export const guardarContenidoSchema = (slug: SlugContenido) =>
  type({ body: { datos: ESQUEMAS[slug] } });
