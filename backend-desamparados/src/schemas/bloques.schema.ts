import { type } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import { medioGaleriaSchema, problemaDelMedio } from './medios.schema.js';
import type { TipoBloque } from '../domain/bloques.js';
import { esDestinoValido } from '../domain/destinos.js';

/** Un texto visible, sin `<` ni `>`: se pinta como texto plano. */
const texto = (max: number) => type(`0 <= string <= ${max}`)
  .matching(/^[^<>]*$/)
  .describe(`un texto de hasta ${max} caracteres, sin < ni >`);

const ETIQUETA = texto(topes.etiqueta);
const TITULO = texto(topes.titulo);
const DESCRIPCION = texto(topes.descripcion);
const PARRAFO = texto(topes.parrafo);
const sinFoto = type('string').matching(/^$/);
const sinEnlace = type('string').matching(/^$/);

/**
 * Enlace de una tarjeta o del botón de una llamada: una página que exista en
 * la web (ver domain/destinos.ts). Con que empezara por una barra se colaban
 * rutas inventadas, y la tarjeta llevaba a «página no encontrada».
 */
const enlaceInterno = type('string <= 200')
  .narrow((enlace) => esDestinoValido(enlace))
  .describe('una página que exista en la web: elígela de la lista');

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

/**
 * Una tarjeta. El enlace es opcional: vacío, la tarjeta es informativa y no
 * lleva a ninguna parte (los cultos del año y los cargos de la Junta son eso,
 * una rejilla de fichas que no enlazan con nada). Con ruta, solo del sitio.
 */
const tarjetaSchema = type({
  titulo: TITULO,
  // Tope propio y no el de `descripcion`: en una tarjeta cabe un párrafo de
  // dos o tres líneas —los fines del Grupo Parroquial se explican así— y con
  // los 200 de una descripción el texto que ya tenía la web no entraba.
  descripcion: texto(topes.textoTarjeta),
  enlace: sinEnlace.or(enlaceInterno),
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

/**
 * Bloque de galería: fotos nuestras y vídeos de YouTube o Vimeo, en pase.
 *
 * Las mismas reglas que la galería de la Sagrada Titular, y del mismo sitio
 * (`medios.schema.ts`): descripción obligatoria en todo medio, foto propia o
 * vídeo de la lista cerrada, y portada propia en los vídeos para no llamar a
 * YouTube antes de que nadie pulse el play.
 *
 * **La dirección del vídeo llega ya normalizada**, igual que el HTML del bloque
 * de texto llega ya saneado: la ruta pasa el documento por `sanearBloques`
 * antes de validarlo. Aquí no se normaliza con un `.pipe()` —que es como lo
 * hace la Titular— porque no serviría de nada: `paginaDeBloquesSchema` valida
 * cada bloque dentro de un `.narrow()` y **descarta la salida** del esquema,
 * así que lo que se guardaría sería el valor crudo, tal y como lo pegó quien
 * edita. Se normaliza antes y aquí solo se comprueba.
 *
 * Una galería vacía se rechaza: un bloque que no pinta nada es un hueco en la
 * página y quien edita no tiene forma de saber por qué no se ve.
 */
const galeriaSchema = type({
  ...comunes,
  tipo: "'galeria'",
  medios: medioGaleriaSchema.array().atLeastLength(1).atMostLength(topes.mediosPorGaleria),
}).narrow((datos, ctx) => {
  for (const [indice, medio] of datos.medios.entries()) {
    const problema = problemaDelMedio(medio);
    if (problema) return ctx.reject({ path: ['medios', indice, problema.campo], problem: problema.problema });
  }
  return true;
});

/**
 * Bloque de llamada: un texto y un botón que lleva a otra página del sitio.
 *
 * El botón es obligatorio; sin él esto es un bloque de texto con menos
 * posibilidades, y el recuadro destacado prometería una acción que no existe.
 * El destino se valida como el de las tarjetas: solo rutas de este sitio.
 */
const llamadaSchema = type({
  ...comunes,
  tipo: "'llamada'",
  texto: PARRAFO,
  boton: ETIQUETA,
  enlace: enlaceInterno,
}).narrow((datos, ctx) => datos.boton.trim() !== ''
  ? true
  : ctx.reject({ path: ['boton'], problem: 'no puede quedar en blanco: es lo que se lee dentro del botón' }));

/**
 * Bloque de datos: pares de etiqueta y valor, como el horario de los cultos o
 * los datos de contacto de la parroquia.
 *
 * El valor usa el tope de `lugar` y no el de `etiqueta` porque ahí caben cosas
 * como una dirección entera o «Todos los viernes de Cuaresma, a las 20:00».
 */
const lineaDatosSchema = type({
  etiqueta: ETIQUETA,
  valor: texto(topes.lugar),
});

const datosSchema = type({
  ...comunes,
  tipo: "'datos'",
  lineas: lineaDatosSchema.array().atLeastLength(1).atMostLength(topes.lineasPorBloque),
}).narrow((datos, ctx) => {
  // Una línea sin etiqueta deja un valor suelto sin decir de qué es. Misma
  // regla que la tarjeta sin título y la foto sin descripción: en cuanto hay
  // contenido, lo que lo nombra deja de ser opcional.
  const indice = datos.lineas.findIndex((linea) => linea.etiqueta.trim() === '');
  return indice === -1
    ? true
    : ctx.reject({ path: ['lineas', indice, 'etiqueta'], problem: 'no puede quedar en blanco' });
});

/**
 * Bloque de itinerario: las paradas de la procesión con su hora.
 *
 * Sale de la página del Recorrido, que tenía su propio formulario en el CMS.
 * La hora se enseña tal cual dentro de la pastilla, así que se exige que lo
 * parezca: sin esto cabía un párrafo donde caben cinco caracteres.
 *
 * El lugar usa el tope de `lugar` y no el de `descripcion`: es el nombre de una
 * calle o una plaza, y que hoy compartan valor es casualidad, no un vínculo.
 */
const hora = type('string').matching(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe('una hora en formato 24 h, como 17:30');

const paradaSchema = type({ hora, lugar: texto(topes.lugar) });

const itinerarioSchema = type({
  ...comunes,
  tipo: "'itinerario'",
  paradas: paradaSchema.array().atLeastLength(1).atMostLength(topes.paradasPorItinerario),
}).narrow((datos, ctx) => {
  // Una parada sin lugar es una hora suelta: no dice por dónde pasa la
  // procesión, que es justo para lo que se consulta esta página.
  const indice = datos.paradas.findIndex((parada) => parada.lugar.trim() === '');
  return indice === -1
    ? true
    : ctx.reject({ path: ['paradas', indice, 'lugar'], problem: 'no puede quedar en blanco' });
});

/**
 * Bloque de cronología: los hitos de la historia del Grupo Parroquial, en el
 * orden en que se leen.
 *
 * Sale de la página de Historia, que tenía su propio formulario en el CMS. Las
 * reglas son las de entonces: el color es uno de tres cerrados (granate es el
 * del Sábado de Pasión y dorado marca el momento actual; no hay color libre) y
 * una foto de hito lleva descripción en cuanto está.
 *
 * El relato es texto plano con los párrafos separados por una línea en blanco,
 * no HTML: la web lo parte al pintarlo, y así no hay nada que sanear.
 */
const tonoHito = type("'ninguno' | 'granate' | 'oro'");

const hitoSchema = type({
  periodo: ETIQUETA,
  etiqueta: ETIQUETA,
  titulo: TITULO,
  relato: texto(topes.relato),
  foto: { url: sinFoto.or(rutaImagenPublica), alt: DESCRIPCION, pie: ETIQUETA },
  tono: tonoHito,
});

const cronologiaSchema = type({
  ...comunes,
  tipo: "'cronologia'",
  hitos: hitoSchema.array().atLeastLength(1).atMostLength(topes.hitosPorCronologia),
}).narrow((datos, ctx) => {
  for (const [indice, hito] of datos.hitos.entries()) {
    // El periodo es lo que se lee en grande y lo que forma el índice de la
    // cabecera: un hito sin él es un punto en el raíl que no dice cuándo.
    if (hito.periodo.trim() === '') {
      return ctx.reject({ path: ['hitos', indice, 'periodo'], problem: 'no puede quedar en blanco' });
    }
    if (hito.foto.url !== '' && hito.foto.alt.trim() === '') {
      return ctx.reject({ path: ['hitos', indice, 'foto', 'alt'], problem: 'es obligatorio cuando hay una foto' });
    }
  }
  return true;
});

/**
 * Bloque de listado: lo que el Grupo Parroquial publica desde otras pantallas
 * del CMS (noticias, agenda, publicaciones), pintado donde se ponga el bloque.
 *
 * El bloque no guarda la lista, solo de dónde sale: las noticias se escriben
 * en «Noticias», los actos en «Agenda» y los PDF en «Publicaciones», y este
 * bloque las recoge al vuelo. Así la página que las rodea —cabecera, textos,
 * fotos— se edita como cualquier otra sin copiar ni un dato.
 *
 * La lista de fuentes es cerrada: cada una es una consulta concreta que ya
 * existía en la web. Una fuente libre sería una consulta libre.
 */
export const FUENTES_LISTADO = [
  'noticias-recientes', 'agenda-proxima',
  'noticias', 'agenda',
  'publicaciones', 'boletines', 'dossier',
] as const;

const listadoSchema = type({
  ...comunes,
  tipo: "'listado'",
  fuente: type.enumerated(...FUENTES_LISTADO),
});

/**
 * Bloque de contacto: el formulario de la página de Contacto y, a su lado, la
 * tarjeta con las formas de llegar al Grupo Parroquial.
 *
 * El formulario no se configura: sus campos, sus comprobaciones y la trampa
 * para robots son de código, porque lo que llega se envía por correo y no
 * es algo que convenga poder romper desde el CMS. Lo editable es lo de
 * alrededor: el título de la tarjeta y sus líneas. Sin líneas, la tarjeta no
 * se pinta y el formulario ocupa todo el ancho.
 */
const contactoSchema = type({
  ...comunes,
  tipo: "'contacto'",
  tituloDatos: TITULO,
  lineas: lineaDatosSchema.array().atMostLength(topes.lineasPorBloque),
}).narrow((datos, ctx) => {
  // Misma regla que el bloque de datos: un valor sin etiqueta no dice de qué es.
  const indice = datos.lineas.findIndex((linea) => linea.etiqueta.trim() === '');
  return indice === -1
    ? true
    : ctx.reject({ path: ['lineas', indice, 'etiqueta'], problem: 'no puede quedar en blanco' });
});

const POR_TIPO = {
  texto: textoSchema,
  foto: fotoSchema,
  galeria: galeriaSchema,
  tarjetas: tarjetasSchema,
  llamada: llamadaSchema,
  datos: datosSchema,
  itinerario: itinerarioSchema,
  cronologia: cronologiaSchema,
  listado: listadoSchema,
  contacto: contactoSchema,
} as const;

export const esquemaDeBloque = (tipo: TipoBloque) => POR_TIPO[tipo as keyof typeof POR_TIPO];

/**
 * La cabecera de la página. Está siempre y no se puede quitar.
 *
 * La ceja (la línea pequeña en mayúsculas encima del título) es opcional y
 * solo la lleva Historia, cuya cabecera tiene diseño propio. Las demás no la
 * pintan, y por eso no traen la clave en sus valores de partida: al mezclar,
 * lo guardado que no está en los valores de partida se descarta.
 */
export const cabeceraSchema = type({
  'ceja?': ETIQUETA,
  titulo: TITULO,
  subtitulo: DESCRIPCION,
  foto: sinFoto.or(rutaImagenPublica),
  // La descripción es opcional, al revés que en el plano del recorrido o en las
  // fotos de los hitos: la foto de la cabecera no se pinta como una foto, es el
  // fondo velado de la página (`FondoDePagina`) y va fuera del árbol accesible,
  // así que nadie la oiría. Se sigue guardando lo escrito: describe la foto por
  // si algún día vuelve a verse como tal.
  fotoAlt: DESCRIPCION,
}).narrow((datos, ctx) => {
  // Un título en blanco (o solo espacios: tres espacios no son un título) deja
  // la página sin título en producción. El CMS ya avisa antes de mandar nada,
  // pero esa comprobación vive solo en el navegador; sin esta, un PUT hecho a
  // mano se colaba igual.
  if (datos.titulo.trim() === '') return ctx.reject({ path: ['titulo'], problem: 'no puede quedar en blanco' });
  return true;
});
