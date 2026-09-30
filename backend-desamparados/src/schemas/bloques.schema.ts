import { type, ArkErrors } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import presentacion from '../../../shared/presentacion-de-bloques.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import { medioGaleriaSchema, problemaDelMedio } from './medios.schema.js';
import type { TipoBloque } from '../domain/bloques.js';
import { esDestinoValido } from '../domain/destinos.js';
import { problemaDePresentacion } from '../domain/presentacion.js';
import { esPdfPropio } from '../utils/rutas-propias.js';

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
  // Opcionales, llegaron con las opciones de presentación: una foto arriba de
  // la tarjeta o un icono de la lista cerrada. Una tarjeta de antes no los trae.
  'foto?': sinFoto.or(rutaImagenPublica),
  'fotoAlt?': DESCRIPCION,
  'icono?': type.enumerated('', ...presentacion.iconosDeTarjeta),
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
  if (indice !== -1) return ctx.reject({ path: ['tarjetas', indice, 'titulo'], problem: 'no puede quedar en blanco' });
  // Como toda foto de la web: con descripción en cuanto está.
  const sinAlt = datos.tarjetas.findIndex((tarjeta) => (tarjeta.foto ?? '') !== '' && (tarjeta.fotoAlt ?? '').trim() === '');
  return sinAlt === -1
    ? true
    : ctx.reject({ path: ['tarjetas', sinAlt, 'fotoAlt'], problem: 'es obligatoria cuando la tarjeta lleva foto' });
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
const hora = type('string').matching(/^(([01]\d|2[0-3]):[0-5]\d)?$/)
  .describe('una hora en formato 24 h, como 17:30, o vacía si aún no se sabe');

/**
 * Dónde cae la parada en el recorrido del mapa: la fracción del recorrido, de
 * 0 (la salida) a 1 (la entrada). Opcional: sin ella, la parada se reparte
 * entre sus vecinas. La hora puede ir vacía mientras no se sepa: la web dice
 * «hora por confirmar».
 */
const paradaSchema = type({ hora, lugar: texto(topes.lugar), 'enRuta?': '0 <= number <= 1' });

/** Un punto del mapa: [longitud, latitud], como en GeoJSON. */
const coordenada = type(['-180 <= number <= 180', '-90 <= number <= 90']);

const itinerarioSchema = type({
  ...comunes,
  tipo: "'itinerario'",
  paradas: paradaSchema.array().atLeastLength(1).atMostLength(topes.paradasPorItinerario),
  // El recorrido sobre el mapa (disposición «plano»): las esquinas que se
  // pulsaron en el CMS y la línea que sale de ellas, pegada a las calles si
  // `pegado`. Se guardan las dos: las esquinas para seguir editando y la
  // línea para pintarla sin volver a calcular el camino.
  'recorrido?': {
    esquinas: coordenada.array().atMostLength(topes.puntosPorTrazado),
    linea: coordenada.array().atMostLength(topes.puntosPorLinea),
    pegado: 'boolean',
  },
}).narrow((datos, ctx) => {
  // Una parada sin lugar es una hora suelta: no dice por dónde pasa la
  // procesión, que es justo para lo que se consulta esta página.
  const indice = datos.paradas.findIndex((parada) => parada.lugar.trim() === '');
  if (indice !== -1) return ctx.reject({ path: ['paradas', indice, 'lugar'], problem: 'no puede quedar en blanco' });
  // La línea es una línea: un punto suelto no dibuja nada.
  if (datos.recorrido && datos.recorrido.linea.length === 1) {
    return ctx.reject({ path: ['recorrido', 'linea'], problem: 'necesita al menos dos puntos' });
  }
  return true;
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

/** Que un texto obligatorio no sea solo espacios. */
const enBlanco = (valor: string) => valor.trim() === '';

/**
 * Foto con texto: una foto a un lado y un texto con formato al otro, con un
 * botón opcional debajo. Es el «dos columnas» de las webs, hecho bloque para
 * que en el móvil se apile siempre bien (la foto encima) en vez de dejar a
 * quien edita componer columnas a mano.
 */
const fotoTextoSchema = type({
  ...comunes,
  tipo: "'fotoTexto'",
  url: rutaImagenPublica,
  alt: DESCRIPCION,
  pie: ETIQUETA,
  // Saneado antes de validar, como el del bloque de texto.
  html: type(`1 <= string <= ${topes.html}`),
  boton: ETIQUETA,
  enlace: sinEnlace.or(enlaceInterno),
}).narrow((datos, ctx) => {
  if (enBlanco(datos.alt)) return ctx.reject({ path: ['alt'], problem: 'es obligatoria: describe lo que se ve' });
  if (enBlanco(datos.html)) return ctx.reject({ path: ['html'], problem: 'no puede quedar en blanco' });
  // Botón y destino van juntos: uno sin el otro es un botón que no lleva a
  // ninguna parte o un destino al que no se llega.
  if (!enBlanco(datos.boton) && datos.enlace === '') return ctx.reject({ path: ['enlace'], problem: 'falta: el botón necesita a dónde llevar' });
  if (enBlanco(datos.boton) && datos.enlace !== '') return ctx.reject({ path: ['boton'], problem: 'falta el texto del botón' });
  return true;
});

/**
 * Foto fija y texto que pasa: unas partes de texto, cada una con su foto. Al
 * leer, la foto se queda quieta a un lado y cambia a la de la parte que se lee.
 * Para Trono, Enseres o Ajuar, donde cada párrafo habla de una pieza.
 *
 * La foto es obligatoria en cada parte: es lo que cambia. El texto es plano
 * con los párrafos separados por una línea en blanco, como el relato de la
 * cronología.
 */
const pasoFotoFijaSchema = type({
  titulo: TITULO,
  texto: texto(topes.relato),
  foto: { url: rutaImagenPublica, alt: DESCRIPCION, pie: ETIQUETA },
});

const fotoFijaSchema = type({
  ...comunes,
  tipo: "'fotoFija'",
  pasos: pasoFotoFijaSchema.array().atLeastLength(1).atMostLength(topes.pasosPorBloque),
}).narrow((datos, ctx) => {
  for (const [indice, paso] of datos.pasos.entries()) {
    if (enBlanco(paso.texto)) return ctx.reject({ path: ['pasos', indice, 'texto'], problem: 'no puede quedar en blanco' });
    if (enBlanco(paso.foto.alt)) return ctx.reject({ path: ['pasos', indice, 'foto', 'alt'], problem: 'es obligatoria: describe lo que se ve' });
  }
  return true;
});

/** Una cita: unas palabras destacadas y, si se quiere, de quién son. */
const citaSchema = type({
  ...comunes,
  tipo: "'cita'",
  texto: PARRAFO,
  autor: ETIQUETA,
  fuente: DESCRIPCION,
}).narrow((datos, ctx) => enBlanco(datos.texto)
  ? ctx.reject({ path: ['texto'], problem: 'no puede quedar en blanco' })
  : true);

/**
 * Un vídeo suelto de YouTube o Vimeo. Las mismas reglas que un vídeo de la
 * galería (`problemaDelMedio`): dirección ya normalizada por `sanearBloques`,
 * portada propia para no llamar a YouTube hasta que alguien pulse el play, y
 * descripción obligatoria.
 */
const videoSchema = type({
  ...comunes,
  tipo: "'video'",
  url: 'string <= 300',
  portada: sinFoto.or(rutaImagenPublica),
  alt: DESCRIPCION,
  pie: ETIQUETA,
}).narrow((datos, ctx) => {
  const problema = problemaDelMedio({ ...datos, tipo: 'video' });
  return problema ? ctx.reject({ path: [problema.campo], problem: problema.problema }) : true;
});

/** Uno o varios botones en fila, cada uno a una página del sitio. */
const botonSchema = type({
  texto: ETIQUETA,
  enlace: enlaceInterno,
  estilo: "'principal' | 'secundario'",
});

const botonesSchema = type({
  ...comunes,
  tipo: "'botones'",
  botones: botonSchema.array().atLeastLength(1).atMostLength(topes.botonesPorBloque),
}).narrow((datos, ctx) => {
  const indice = datos.botones.findIndex((boton) => enBlanco(boton.texto));
  return indice === -1
    ? true
    : ctx.reject({ path: ['botones', indice, 'texto'], problem: 'no puede quedar en blanco: es lo que se lee en el botón' });
});

/**
 * Preguntas plegables: la pregunta a la vista y la respuesta al pulsarla. La
 * respuesta es texto plano con los párrafos separados por una línea en blanco,
 * como el relato de un hito: nada que sanear.
 */
const preguntaSchema = type({ pregunta: TITULO, respuesta: texto(topes.respuesta) });

const preguntasSchema = type({
  ...comunes,
  tipo: "'preguntas'",
  preguntas: preguntaSchema.array().atLeastLength(1).atMostLength(topes.preguntasPorBloque),
}).narrow((datos, ctx) => {
  for (const [indice, item] of datos.preguntas.entries()) {
    if (enBlanco(item.pregunta)) return ctx.reject({ path: ['preguntas', indice, 'pregunta'], problem: 'no puede quedar en blanco' });
    if (enBlanco(item.respuesta)) return ctx.reject({ path: ['preguntas', indice, 'respuesta'], problem: 'no puede quedar en blanco' });
  }
  return true;
});

/** Documentos para descargar: PDF subidos desde el CMS, nada de enlaces externos. */
const archivoSchema = type({
  titulo: TITULO,
  descripcion: DESCRIPCION,
  url: type('string <= 300').narrow(esPdfPropio).describe('un PDF subido desde el CMS'),
});

const descargasSchema = type({
  ...comunes,
  tipo: "'descargas'",
  archivos: archivoSchema.array().atLeastLength(1).atMostLength(topes.descargasPorBloque),
}).narrow((datos, ctx) => {
  const indice = datos.archivos.findIndex((archivo) => enBlanco(archivo.titulo));
  return indice === -1
    ? true
    : ctx.reject({ path: ['archivos', indice, 'titulo'], problem: 'no puede quedar en blanco' });
});

/**
 * Un mapa de Google con un lugar. Se guarda la dirección que se buscaría en
 * Google Maps, no coordenadas: es lo que sabe escribir quien edita. El mapa no
 * se carga hasta que el visitante acepta las cookies o lo pide (RGPD), como el
 * del pie.
 */
const mapaSchema = type({
  ...comunes,
  tipo: "'mapa'",
  lugar: TITULO,
  direccion: texto(topes.lugar),
  // Opcional, llegó con la disposición «al lado» (26-09-2026): unas líneas
  // para orientarse (el barrio, la entrada) junto a la dirección.
  'indicaciones?': PARRAFO,
}).narrow((datos, ctx) => enBlanco(datos.direccion)
  ? ctx.reject({ path: ['direccion'], problem: 'no puede quedar en blanco: es lo que se busca en el mapa' })
  : true);

/**
 * Cuenta atrás hasta una fecha y hora de Madrid (el Sábado de Pasión, un
 * triduo). Al llegar, en vez de ceros se lee `textoFinal`.
 */
const FECHA_Y_HORA = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

const cuentaAtrasSchema = type({
  ...comunes,
  tipo: "'cuentaAtras'",
  fecha: type('string').matching(FECHA_Y_HORA).describe('una fecha y hora, como 2027-03-20T18:00'),
  texto: ETIQUETA,
  textoFinal: DESCRIPCION,
}).narrow((datos, ctx) => {
  const [anio, mes, dia] = datos.fecha.slice(0, 10).split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
    ? true
    : ctx.reject({ path: ['fecha'], problem: 'no es una fecha del calendario' });
});

/**
 * Horario vivo: las misas y el despacho de la parroquia, con los que la web
 * calcula a qué hora es la próxima misa y si el despacho está abierto ahora.
 *
 * Los días van de 0 (domingo) a 6 (sábado), como `Date.getDay()`. Cada franja
 * de misas lleva sus horas y, si cambian en verano, las de verano; vacías,
 * valen las de siempre. El verano va de un día del año a otro (MM-DD) y
 * puede cruzar el año; sin fechas no hay horario de verano.
 */
const diaDeLaSemana = type('0 <= number.integer <= 6');
const diasSchema = diaDeLaSemana.array().atLeastLength(1).atMostLength(7);
const DIA_DEL_ANIO = /^$|^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** Aquí la hora no puede ir vacía, al revés que en el itinerario: es para lo que está el bloque. */
const horaFija = type('string').matching(/^([01]\d|2[0-3]):[0-5]\d$/).describe('una hora en formato 24 h, como 19:00');

const franjaDeMisasSchema = type({
  etiqueta: ETIQUETA,
  dias: diasSchema,
  horas: horaFija.array().atLeastLength(1).atMostLength(topes.horasPorFranja),
  horasVerano: horaFija.array().atMostLength(topes.horasPorFranja),
});

const turnoDeDespachoSchema = type({ dias: diasSchema, desde: horaFija, hasta: horaFija });

const horarioSchema = type({
  ...comunes,
  tipo: "'horario'",
  misas: franjaDeMisasSchema.array().atLeastLength(1).atMostLength(topes.franjasPorHorario),
  despacho: turnoDeDespachoSchema.array().atMostLength(topes.franjasPorHorario),
  verano: {
    desde: type('string').matching(DIA_DEL_ANIO).describe('un día del año, como 07-01'),
    hasta: type('string').matching(DIA_DEL_ANIO).describe('un día del año, como 08-31'),
  },
  lineas: lineaDatosSchema.array().atMostLength(topes.lineasPorBloque),
}).narrow((datos, ctx) => {
  const sinNombre = datos.misas.findIndex((franja) => enBlanco(franja.etiqueta));
  if (sinNombre !== -1) return ctx.reject({ path: ['misas', sinNombre, 'etiqueta'], problem: 'no puede quedar en blanco: dice qué días son' });
  // Un turno que acaba antes de empezar nunca estaría abierto.
  const alReves = datos.despacho.findIndex((turno) => turno.hasta <= turno.desde);
  if (alReves !== -1) return ctx.reject({ path: ['despacho', alReves, 'hasta'], problem: 'tiene que ser después de la hora de apertura' });
  // El verano va entero o no va: con una sola fecha no se sabe cuándo acaba.
  if ((datos.verano.desde === '') !== (datos.verano.hasta === '')) {
    return ctx.reject({ path: ['verano', datos.verano.desde === '' ? 'desde' : 'hasta'], problem: 'falta: el verano necesita principio y fin' });
  }
  const sinEtiqueta = datos.lineas.findIndex((linea) => enBlanco(linea.etiqueta));
  if (sinEtiqueta !== -1) return ctx.reject({ path: ['lineas', sinEtiqueta, 'etiqueta'], problem: 'no puede quedar en blanco' });
  return true;
});

/**
 * Un dibujo de líneas que se traza al bajar por la página, con un texto al
 * lado. Los dibujos son de una lista cerrada, hechos en código: el templo de
 * Santa María Goretti y el signo pasionista. El texto es HTML con formato,
 * saneado antes de validar como el del bloque de texto.
 *
 * `foto`, opcional (26-09-2026): una ilustración que se pinta en lugar del
 * dibujo de líneas, como la del templo. Con descripción, como toda foto.
 */
export const DIBUJOS = ['templo', 'signoPasionista'] as const;

const dibujoSchema = type({
  ...comunes,
  tipo: "'dibujo'",
  dibujo: type.enumerated(...DIBUJOS),
  html: type(`1 <= string <= ${topes.html}`),
  'foto?': { url: sinFoto.or(rutaImagenPublica), alt: DESCRIPCION },
}).narrow((datos, ctx) => {
  if (enBlanco(datos.html)) return ctx.reject({ path: ['html'], problem: 'no puede quedar en blanco' });
  if (datos.foto && datos.foto.url !== '' && enBlanco(datos.foto.alt)) {
    return ctx.reject({ path: ['foto', 'alt'], problem: 'es obligatoria: describe lo que se ve' });
  }
  return true;
});

/**
 * Tres anillos entrelazados: los tres fines del Grupo (culto, caridad y
 * formación), que no se entienden por separado. Siempre tres, uno por anillo:
 * el dibujo es de tres. Cada fin con su texto y, si se quiere, un botón a su
 * página; en el cruce de los tres, una palabra (`centro`), y debajo un párrafo.
 */
const finSchema = type({
  titulo: TITULO,
  texto: texto(topes.textoTarjeta),
  boton: ETIQUETA,
  enlace: sinEnlace.or(enlaceInterno),
});

const anillosSchema = type({
  ...comunes,
  tipo: "'anillos'",
  centro: ETIQUETA,
  fines: finSchema.array().exactlyLength(3),
  texto: PARRAFO,
}).narrow((datos, ctx) => {
  for (const [indice, fin] of datos.fines.entries()) {
    if (enBlanco(fin.titulo)) return ctx.reject({ path: ['fines', indice, 'titulo'], problem: 'no puede quedar en blanco' });
    // Botón y destino van juntos, como en la foto con texto.
    if (!enBlanco(fin.boton) && fin.enlace === '') return ctx.reject({ path: ['fines', indice, 'enlace'], problem: 'falta: el botón necesita a dónde llevar' });
    if (enBlanco(fin.boton) && fin.enlace !== '') return ctx.reject({ path: ['fines', indice, 'boton'], problem: 'falta el texto del botón' });
  }
  return true;
});

/**
 * Dos puertas: dos paneles para dos lectores distintos, como «Necesito ayuda»
 * y «Quiero ayudar» en Caridad. Siempre dos, uno al lado del otro. Cada uno con
 * sus datos (el despacho, la dirección, el Bizum…) y un botón.
 *
 * Un dato sin valor no se pinta: así se puede dejar preparado el del donativo
 * hasta que el Grupo lo dé, sin que salga un hueco en la página. `copiable`
 * pone al lado un botón para copiar el valor (una cuenta, un Bizum).
 */
const datoDePuertaSchema = type({
  etiqueta: ETIQUETA,
  valor: ETIQUETA,
  nota: ETIQUETA,
  copiable: 'boolean',
});

const puertaSchema = type({
  ceja: ETIQUETA,
  titulo: TITULO,
  texto: PARRAFO,
  datos: datoDePuertaSchema.array().atMostLength(topes.datosPorPuerta),
  boton: ETIQUETA,
  enlace: sinEnlace.or(enlaceInterno),
});

const puertasSchema = type({
  ...comunes,
  tipo: "'puertas'",
  puertas: puertaSchema.array().exactlyLength(2),
}).narrow((datos, ctx) => {
  for (const [indice, puerta] of datos.puertas.entries()) {
    if (enBlanco(puerta.titulo)) return ctx.reject({ path: ['puertas', indice, 'titulo'], problem: 'no puede quedar en blanco' });
    const sinNombre = puerta.datos.findIndex((dato) => enBlanco(dato.etiqueta));
    if (sinNombre !== -1) return ctx.reject({ path: ['puertas', indice, 'datos', sinNombre, 'etiqueta'], problem: 'no puede quedar en blanco' });
    // Botón y destino van juntos, como en los tres anillos.
    if (!enBlanco(puerta.boton) && puerta.enlace === '') return ctx.reject({ path: ['puertas', indice, 'enlace'], problem: 'falta: el botón necesita a dónde llevar' });
    if (enBlanco(puerta.boton) && puerta.enlace !== '') return ctx.reject({ path: ['puertas', indice, 'boton'], problem: 'falta el texto del botón' });
  }
  return true;
});

/**
 * Programa: los cultos del curso, uno por fila, con cuándo son («Octubre»,
 * «Cada mes»). `mes` (1–12, o 0 si no tiene uno fijo) es lo que deja a la web
 * marcar sola cuál es el próximo y poner su fecha, sacada de la Agenda.
 */
const filaDeProgramaSchema = type({
  cuando: ETIQUETA,
  mes: '0 <= number.integer <= 12',
  titulo: TITULO,
  texto: PARRAFO,
  boton: ETIQUETA,
  enlace: sinEnlace.or(enlaceInterno),
});

const programaSchema = type({
  ...comunes,
  tipo: "'programa'",
  filas: filaDeProgramaSchema.array().atLeastLength(1).atMostLength(topes.filasPorPrograma),
}).narrow((datos, ctx) => {
  for (const [indice, fila] of datos.filas.entries()) {
    if (enBlanco(fila.cuando)) return ctx.reject({ path: ['filas', indice, 'cuando'], problem: 'no puede quedar en blanco' });
    if (enBlanco(fila.titulo)) return ctx.reject({ path: ['filas', indice, 'titulo'], problem: 'no puede quedar en blanco' });
    if (!enBlanco(fila.boton) && fila.enlace === '') return ctx.reject({ path: ['filas', indice, 'enlace'], problem: 'falta: el botón necesita a dónde llevar' });
    if (enBlanco(fila.boton) && fila.enlace !== '') return ctx.reject({ path: ['filas', indice, 'boton'], problem: 'falta el texto del botón' });
  }
  return true;
});

/**
 * Relación: los cargos de un órgano (la Junta de Gobierno), cada uno con quien
 * lo ocupa y lo que hace, y arriba el mandato y una nota («Elegida en Cabildo
 * General el…»). El nombre puede quedar vacío mientras no se sepa: la web pinta
 * entonces el cargo y su función. `enlace`, opcional, lleva a la página de la
 * vocalía.
 */
const filaDeRelacionSchema = type({
  cargo: ETIQUETA,
  nombre: TITULO,
  texto: DESCRIPCION,
  enlace: sinEnlace.or(enlaceInterno),
});

const relacionSchema = type({
  ...comunes,
  tipo: "'relacion'",
  mandato: ETIQUETA,
  nota: ETIQUETA,
  filas: filaDeRelacionSchema.array().atLeastLength(1).atMostLength(topes.filasPorRelacion),
}).narrow((datos, ctx) => {
  const sinCargo = datos.filas.findIndex((fila) => enBlanco(fila.cargo));
  return sinCargo === -1 ? true : ctx.reject({ path: ['filas', sinCargo, 'cargo'], problem: 'no puede quedar en blanco' });
});

/**
 * Carrusel de piezas: una pieza cada vez, con su foto grande y, al lado, la
 * familia (Insignias, Orfebrería…), el nombre, su historia y una cartela de
 * datos (autor, año, materiales). Para Enseres y Ajuar. El pie de la foto es
 * para el crédito del fotógrafo. Un dato va entero o no va: sin nombre, el
 * valor no se sabría de qué es.
 */
const datoDePiezaSchema = type({ etiqueta: ETIQUETA, valor: TITULO });

const piezaSchema = type({
  familia: ETIQUETA,
  titulo: TITULO,
  texto: texto(topes.textoTarjeta),
  foto: { url: rutaImagenPublica, alt: DESCRIPCION, pie: ETIQUETA },
  datos: datoDePiezaSchema.array().atMostLength(topes.datosPorPieza),
});

const carruselSchema = type({
  ...comunes,
  tipo: "'carrusel'",
  piezas: piezaSchema.array().atLeastLength(1).atMostLength(topes.piezasPorCarrusel),
}).narrow((datos, ctx) => {
  for (const [indice, pieza] of datos.piezas.entries()) {
    if (enBlanco(pieza.titulo)) return ctx.reject({ path: ['piezas', indice, 'titulo'], problem: 'no puede quedar en blanco' });
    if (enBlanco(pieza.foto.alt)) return ctx.reject({ path: ['piezas', indice, 'foto', 'alt'], problem: 'es obligatoria: describe lo que se ve' });
    const cojo = pieza.datos.findIndex((dato) => enBlanco(dato.etiqueta) !== enBlanco(dato.valor));
    if (cojo !== -1) return ctx.reject({ path: ['piezas', indice, 'datos', cojo], problem: 'necesita nombre y valor' });
  }
  return true;
});

/**
 * Donativo: unos importes sugeridos (y «otro», que escribe el donante),
 * destinos si el Grupo quiere que se elija («Caridad», «Cultos»…) y el pago
 * por la pasarela del banco, sin cuenta en la web.
 *
 * Lo editable es lo que se ofrece; el formulario y el cobro son de código. El
 * servidor vuelve a leer este bloque al cobrar: un importe fuera de los
 * límites o un destino que no está aquí no pasan aunque se escriban a mano.
 */
const donativoSchema = type({
  ...comunes,
  tipo: "'donativo'",
  texto: PARRAFO,
  importes: type(`${topes.donativoMinimoEuros} <= number.integer <= ${topes.donativoMaximoEuros}`).array().atLeastLength(1).atMostLength(topes.importesPorDonativo),
  destinos: ETIQUETA.array().atMostLength(topes.destinosPorDonativo),
}).narrow((datos, ctx) => {
  if (new Set(datos.importes).size !== datos.importes.length) return ctx.reject({ path: ['importes'], problem: 'tiene importes repetidos' });
  const vacio = datos.destinos.findIndex(enBlanco);
  if (vacio !== -1) return ctx.reject({ path: ['destinos', vacio], problem: 'no puede quedar en blanco' });
  const normal = datos.destinos.map((d) => d.trim().toLocaleLowerCase('es-ES'));
  if (new Set(normal).size !== normal.length) return ctx.reject({ path: ['destinos'], problem: 'tiene destinos repetidos' });
  return true;
});

/** Aire entre dos bloques, con una línea si se quiere. Todo es presentación. */
const espacioSchema = type({
  ...comunes,
  tipo: "'espacio'",
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
  fotoTexto: fotoTextoSchema,
  cita: citaSchema,
  video: videoSchema,
  botones: botonesSchema,
  preguntas: preguntasSchema,
  descargas: descargasSchema,
  mapa: mapaSchema,
  cuentaAtras: cuentaAtrasSchema,
  espacio: espacioSchema,
  fotoFija: fotoFijaSchema,
  horario: horarioSchema,
  dibujo: dibujoSchema,
  anillos: anillosSchema,
  puertas: puertasSchema,
  programa: programaSchema,
  relacion: relacionSchema,
  carrusel: carruselSchema,
  donativo: donativoSchema,
} as const;

export const esquemaDeBloque = (tipo: TipoBloque) => POR_TIPO[tipo as keyof typeof POR_TIPO];

/**
 * Qué falla en un bloque, con la ruta dentro de él, o `null` si vale: su
 * esquema según el tipo y, además, su presentación. Lo usan la página entera y
 * las secciones guardadas, que son bloques sueltos.
 */
export function problemaDeBloque(bloque: unknown): { path: (string | number)[]; problem: string } | null {
  const tipo = (bloque as { tipo?: unknown } | null)?.tipo;
  // El mapa de esquemas es la única autoridad sobre qué tipo se sabe validar:
  // un tipo inventado y uno del catálogo al que le falte esquema caen aquí.
  const esquema = typeof tipo === 'string' ? esquemaDeBloque(tipo as never) : undefined;
  if (!esquema) return { path: ['tipo'], problem: `no es un tipo de bloque conocido: «${String(tipo)}»` };
  const salida = esquema(bloque);
  if (salida instanceof ArkErrors) return { path: [], problem: salida.summary };
  const mal = problemaDePresentacion(tipo as string, (bloque as { presentacion?: unknown }).presentacion);
  if (mal) {
    return {
      path: ['presentacion', ...(mal.campo ? [mal.campo] : [])],
      problem: `la presentación${mal.campo ? ` («${mal.campo}»)` : ''} ${mal.problema}`,
    };
  }
  return null;
}

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
  // La descripción es opcional. En Historia, Agenda y Cultos la foto es el
  // fondo velado de la página y va fuera del árbol accesible. En las demás se
  // ve a todo el ancho arriba y la lee el lector de pantalla si está escrita;
  // si no, se trata como decorativa (el título ya dice qué página es).
  fotoAlt: DESCRIPCION,
  // Qué altura de la foto (0 arriba, 100 abajo) se queda a la vista cuando la
  // cabecera a sangre la recorta. Solo lo traen esas páginas.
  'encuadre?': '0 <= number.integer <= 100',
}).narrow((datos, ctx) => {
  // Un título en blanco (o solo espacios: tres espacios no son un título) deja
  // la página sin título en producción. El CMS ya avisa antes de mandar nada,
  // pero esa comprobación vive solo en el navegador; sin esta, un PUT hecho a
  // mano se colaba igual.
  if (datos.titulo.trim() === '') return ctx.reject({ path: ['titulo'], problem: 'no puede quedar en blanco' });
  return true;
});
