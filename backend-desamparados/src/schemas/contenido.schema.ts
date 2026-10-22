import { type } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import type { SlugContenido } from '../domain/contenido.js';
import { cabeceraSchema, enlaceInterno, problemaDeBloque } from './bloques.schema.js';
import { anclaDe } from '../domain/presentacion.js';
import { VIDEO_PROPIO } from '../utils/rutas-propias.js';

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

const rutaVideoPublica = type('string')
  .matching(VIDEO_PROPIO)
  .describe('un vídeo subido desde el CMS (/storage/public/….mp4)');

const heroSchema = type({
  ceja: ETIQUETA, titulo: TITULO, parrafo: PARRAFO,
  botonPrincipal: ETIQUETA, enlaceSecundario: ETIQUETA,
  // El vídeo de fondo, opcional: vacío, rotan las fotos. Con él, la primera
  // foto es lo que se ve mientras carga y lo único que ve quien tiene el
  // «ahorro de datos» o el «reducir movimiento» puestos. Su tope de peso lo
  // vuelve a comprobar `ContenidoService.guardar` sobre el fichero.
  video: sinFoto.or(rutaVideoPublica),
  // La cuenta atrás hasta la próxima salida. Opcional: sin el campo (las
  // portadas guardadas antes), la web la enseña.
  'cuentaAtras?': 'boolean',
});

const portadaSchema = type({
  hero: heroSchema,
  // Noticias, Agenda y la placa ya no llevan ceja: repetía su título («Actualidad»
  // sobre «Últimas noticias»). Una portada guardada con ella sigue pasando, y
  // `mezclarConDefectos` la tira al leerla.
  actualidad: { titulo: TITULO, enlace: ETIQUETA },
  agenda: {
    titulo: TITULO, parrafo: PARRAFO, enlace: ETIQUETA,
    // `directoTitulo` y `directoTexto` ya no existen (el aviso de retransmisión
    // no se pintaba nunca): una portada guardada con ellos sigue pasando, y
    // `mezclarConDefectos` los tira al leerla.
    // La foto velada del fondo del bloque. Vacía, el bloque queda sobre fondo
    // oscuro liso: a diferencia del Sábado de Pasión, aquí la foto es ambiente.
    imagenUrl: sinFoto.or(rutaImagenPublica),
  },
  accesos: {
    placa: { titulo: TITULO, texto: PARRAFO, boton: ETIQUETA },
    teselas: type({ clave: ETIQUETA, titulo: TITULO, descripcion: PARRAFO }).array().atMostLength(12),
  },
  sabadoDePasion: {
    ceja: ETIQUETA, titulo: TITULO, parrafo: PARRAFO, enlace: ETIQUETA,
    // A dónde lleva el enlace. Antes iba fijo a la página de la salida, que es
    // del módulo paginas-propias: en otra corporación era un enlace roto.
    destino: enlaceInterno,
    // Vacía desde la etapa 6 de la Fase 8: el contenido de partida es neutro y
    // no trae foto de nadie. Exigirla dejaría a una corporación nueva sin poder
    // guardar ningún texto de la portada hasta subir esta foto; sin ella, la
    // web no pinta la banda (InicioPage).
    imagenUrl: sinFoto.or(rutaImagenPublica),
    imagenAlt: DESCRIPCION,
  },
  publicaciones: { boton: ETIQUETA, marcaDeAgua: ETIQUETA },
  // Lo opaco que es el fondo del menú del móvil y la tableta, en %: por debajo
  // de 100 deja ver la foto de detrás. No baja de 40: con menos, las letras del
  // menú se pierden sobre una foto clara.
  menuMovil: { opacidad: '40 <= number.integer <= 100' },
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
  rosario: paginaDeBloquesSchema,
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
  // `versionLeida`: desde qué versión editaba quien guarda (ver ContenidoService.guardar).
  type({ body: { datos: ESQUEMAS[slug], 'versionLeida?': 'number.integer >= 1 | null' } });
