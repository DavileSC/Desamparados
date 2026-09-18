import { type, ArkErrors } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import type { SlugContenido } from '../domain/contenido.js';
import { cabeceraSchema, esquemaDeBloque } from './bloques.schema.js';

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
  for (const [indice, bloque] of datos.bloques.entries()) {
    const tipo = (bloque as { tipo?: unknown })?.tipo;
    // El mapa de esquemas es la única autoridad aquí sobre qué tipo se sabe
    // validar: un tipo inventado y un tipo declarado en el catálogo al que se
    // le olvidó el esquema (`esquemaDeBloque` devuelve `undefined`) caen en la
    // MISMA rama. Preguntarle antes al catálogo (`esTipoBloque`) duplicaba la
    // pregunta y dejaba una rama que ningún test ejercitaba de verdad. Que el
    // catálogo compartido y este mapa no se desincronicen lo vigila el test de
    // cobertura en `bloques-esquemas.test.ts`, no esta guarda.
    const esquema = typeof tipo === 'string' ? esquemaDeBloque(tipo as never) : undefined;
    if (!esquema) {
      return ctx.reject({
        path: ['bloques', indice, 'tipo'],
        problem: `no es un tipo de bloque conocido: «${String(tipo)}»`,
      });
    }
    const salida = esquema(bloque);
    if (salida instanceof ArkErrors) {
      return ctx.reject({ path: ['bloques', indice], problem: salida.summary });
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
  titular: paginaDeBloquesSchema,
  corporacion: paginaDeBloquesSchema,
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
  actualidad: paginaDeBloquesSchema,
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
