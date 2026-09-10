// prisma/seed-contenido.ts
//
// Contenido de ejemplo para poder ver la web y el CMS llenos mientras el Grupo
// Parroquial prepara los textos definitivos. TODO es inventado y está pensado
// para editarse desde el CMS: nada de esto pretende ser información real.
//
// Es idempotente: se puede ejecutar tantas veces como haga falta sin duplicar
// nada. Los modelos con clave única usan `upsert`; los que no la tienen se
// comprueban por título o nombre antes de crearse.

import {
  EventVisibility,
  TipoEvento,
  TipoPublicacion,
  TipoPrenda,
  EstadoPrenda,
  TipoTransaccion,
} from '@prisma/client';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../src/config/db';

/** Fecha relativa a hoy, en días, a las 20:00 salvo que se indique otra hora. */
function enDias(dias: number, hora = 20, minutos = 0): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(hora, minutos, 0, 0);
  return fecha;
}

// ---------------------------------------------------------------------------
// NOTICIAS
// ---------------------------------------------------------------------------

export const NOTICIAS = [
  {
    slug: 'apertura-curso-cofrade',
    titulo: 'Apertura del curso cofrade 2026-2027',
    extracto:
      'El Grupo Parroquial abre el nuevo curso con una eucaristía de acción de gracias y la presentación del calendario de cultos.',
    contenido: `<p>El próximo sábado tendrá lugar la eucaristía de apertura del curso cofrade, presidida por nuestro director espiritual en la Parroquia de los Padres Pasionistas.</p>
<p>Durante la celebración se presentará el calendario de cultos y actividades que nos acompañará hasta el Sábado de Pasión, y se dará la bienvenida a los hermanos incorporados durante el verano.</p>
<p>Al término de la misa habrá una convivencia en el salón parroquial. Se invita a todos los hermanos y a sus familias a participar.</p>`,
    diasDesdeHoy: -3,
  },
  {
    slug: 'triduo-nuestra-senora-desamparados',
    titulo: 'Solemne triduo en honor a Nuestra Señora de los Desamparados',
    extracto:
      'Tres jornadas de oración ante la Sagrada Titular, con predicación a cargo del equipo de formación.',
    contenido: `<p>Como cada año, el Grupo Parroquial celebra solemne triduo en honor a Nuestra Señora de los Desamparados.</p>
<p>Los cultos darán comienzo a las 19:30 con el rezo del santo rosario, seguido de la eucaristía y el ejercicio del triduo. La última jornada concluirá con la salutación a la Santísima Virgen.</p>
<p>Se ruega a los hermanos que acudan con la medalla de la corporación.</p>`,
    diasDesdeHoy: -12,
  },
  {
    slug: 'campana-alimentos',
    titulo: 'Campaña de recogida de alimentos',
    extracto:
      'La vocalía de caridad organiza la recogida anual de alimentos no perecederos en beneficio de las familias atendidas por la parroquia.',
    contenido: `<p>La vocalía de caridad pone en marcha un año más la campaña de recogida de alimentos no perecederos.</p>
<p>Los donativos pueden entregarse en la casa parroquial durante el horario de secretaría. Se necesitan especialmente leche, conservas, legumbre cocida, aceite y alimentación infantil.</p>
<p>Lo recogido se repartirá a través de Cáritas parroquial entre las familias de la barriada.</p>`,
    diasDesdeHoy: -25,
  },
  {
    slug: 'restauracion-manto-procesional',
    titulo: 'Concluye la restauración del manto procesional',
    extracto:
      'El taller de bordado ha devuelto el manto a su estado original tras seis meses de trabajo sobre el terciopelo y la malla de sujeción.',
    contenido: `<p>Ha concluido la restauración del manto procesional de la Sagrada Titular, que se encontraba en el taller desde el pasado mes de febrero.</p>
<p>La intervención ha consistido en el paso del bordado a un terciopelo nuevo, la consolidación de las piezas más deterioradas y la reposición de las hojillas perdidas.</p>
<p>El manto podrá contemplarse en el besamanos del próximo mes de diciembre.</p>`,
    diasDesdeHoy: -40,
  },
  {
    slug: 'convocatoria-cabildo-general',
    titulo: 'Convocatoria de cabildo general de hermanos',
    extracto:
      'Se convoca a todos los hermanos con derecho a voto al cabildo general ordinario de cuentas y actividades.',
    contenido: `<p>Por acuerdo de la junta de gobierno se convoca cabildo general ordinario de hermanos en el salón parroquial.</p>
<p>El orden del día incluye la lectura del acta anterior, la presentación del estado de cuentas del ejercicio, la memoria de actividades y el turno de ruegos y preguntas.</p>
<p>Podrán asistir con voz y voto los hermanos mayores de edad que se encuentren al corriente de sus cuotas.</p>`,
    diasDesdeHoy: -55,
  },
  {
    slug: 'nuevo-grupo-joven',
    titulo: 'Se constituye el grupo joven',
    extracto:
      'Una veintena de hermanos de entre 14 y 25 años forman el nuevo grupo joven del Grupo Parroquial.',
    contenido: `<p>Queda constituido oficialmente el grupo joven, formado por una veintena de hermanos de entre 14 y 25 años.</p>
<p>Su labor se centrará en la formación, la participación en los cultos y la colaboración en las actividades caritativas, con reuniones quincenales los viernes por la tarde.</p>
<p>Los interesados en incorporarse pueden escribir a la secretaría del Grupo Parroquial.</p>`,
    diasDesdeHoy: -70,
  },
  {
    slug: 'reparto-papeletas-sitio',
    titulo: 'Calendario de reparto de papeletas de sitio',
    extracto:
      'Se publica el calendario de reparto de papeletas para la estación de penitencia del Sábado de Pasión.',
    contenido: `<p>La secretaría informa del calendario de reparto de papeletas de sitio para la próxima estación de penitencia.</p>
<p>El reparto se realizará por orden de antigüedad y podrá tramitarse también desde el área de hermanos de esta web, donde cada hermano puede consultar su histórico y descargar la papeleta en PDF.</p>
<p>Se recuerda que es imprescindible estar al corriente de las cuotas para retirar la papeleta.</p>`,
    diasDesdeHoy: -85,
  },
  {
    slug: 'donacion-enseres-albaceria',
    titulo: 'Una familia hermana dona seis hachetas a la albacería',
    extracto:
      'La donación permite completar el tramo de acompañamiento del paso para la próxima salida procesional.',
    contenido: `<p>Una familia de hermanos ha donado seis hachetas de alpaca plateada que pasan a formar parte del patrimonio del Grupo Parroquial.</p>
<p>Con esta donación se completa el tramo de acompañamiento del paso, que hasta ahora se cubría con enseres prestados por otras corporaciones de la ciudad.</p>
<p>La albacería agradece públicamente el gesto y recuerda que el inventario completo puede consultarse en la sección de enseres.</p>`,
    diasDesdeHoy: -110,
  },
];

async function sembrarNoticias() {
  for (const noticia of NOTICIAS) {
    const { diasDesdeHoy, ...datos } = noticia;
    await db.noticia.upsert({
      where: { slug: datos.slug },
      update: {},
      create: {
        ...datos,
        fecha: enDias(diasDesdeHoy, 12),
        visible: true,
        imagenUrl: null,
      },
    });
  }
  console.log(`   ${NOTICIAS.length} noticias`);
}

// ---------------------------------------------------------------------------
// AGENDA
// ---------------------------------------------------------------------------

export const EVENTOS = [
  {
    title: 'Eucaristía de apertura de curso',
    description: 'Celebración de acción de gracias con presentación del calendario de cultos.',
    location: 'Parroquia de los Padres Pasionistas',
    diasDesdeHoy: 5,
    hora: 19,
    type: TipoEvento.CULTO,
    visibility: EventVisibility.public,
  },
  {
    title: 'Reunión de la junta de gobierno',
    description: 'Sesión ordinaria mensual de la junta de gobierno.',
    location: 'Casa parroquial, sala de juntas',
    diasDesdeHoy: 9,
    hora: 20,
    type: TipoEvento.REUNION,
    visibility: EventVisibility.members_only,
  },
  {
    title: 'Catequesis de adultos: el año litúrgico',
    description: 'Primera sesión del itinerario formativo abierto a hermanos y devotos.',
    location: 'Salón parroquial',
    diasDesdeHoy: 14,
    hora: 19,
    type: TipoEvento.FORMACION,
    visibility: EventVisibility.public,
  },
  {
    title: 'Convivencia del grupo joven',
    description: 'Tarde de convivencia y juegos para los hermanos más jóvenes.',
    location: 'Patio parroquial',
    diasDesdeHoy: 21,
    hora: 17,
    type: TipoEvento.SOCIAL,
    visibility: EventVisibility.public,
  },
  {
    title: 'Solemne triduo a Nuestra Señora de los Desamparados',
    description: 'Rosario, eucaristía y ejercicio del triduo cada una de las tres jornadas.',
    location: 'Parroquia de los Padres Pasionistas',
    diasDesdeHoy: 40,
    diasFin: 42,
    hora: 19,
    type: TipoEvento.CULTO,
    visibility: EventVisibility.public,
  },
  {
    title: 'Besamanos a la Sagrada Titular',
    description: 'Jornada de veneración ante la imagen de Nuestra Señora de los Desamparados.',
    location: 'Parroquia de los Padres Pasionistas',
    diasDesdeHoy: 43,
    hora: 11,
    type: TipoEvento.CULTO,
    visibility: EventVisibility.public,
  },
  {
    title: 'Cabildo general ordinario de hermanos',
    description: 'Cuentas del ejercicio, memoria de actividades y ruegos y preguntas.',
    location: 'Salón parroquial',
    diasDesdeHoy: 60,
    hora: 19,
    type: TipoEvento.REUNION,
    visibility: EventVisibility.members_only,
  },
  {
    title: 'Reparto de papeletas de sitio',
    description: 'Atención presencial en secretaría por orden de antigüedad.',
    location: 'Casa parroquial, secretaría',
    diasDesdeHoy: 150,
    diasFin: 160,
    hora: 18,
    type: TipoEvento.OTRO,
    visibility: EventVisibility.members_only,
  },
  {
    title: 'Ensayo general de costaleros',
    description: 'Último ensayo antes de la estación de penitencia. Obligatoria la asistencia.',
    location: 'Explanada de la parroquia',
    diasDesdeHoy: 195,
    hora: 21,
    type: TipoEvento.ENSAYO,
    visibility: EventVisibility.members_only,
  },
  {
    title: 'Estación de penitencia del Sábado de Pasión',
    description: 'Salida procesional de Nuestra Señora de los Desamparados por el centro histórico.',
    location: 'Desde la Parroquia de los Padres Pasionistas',
    diasDesdeHoy: 204,
    hora: 18,
    type: TipoEvento.PROCESION,
    visibility: EventVisibility.public,
  },
];

async function sembrarEventos() {
  for (const evento of EVENTOS) {
    const { diasDesdeHoy, diasFin, hora, ...datos } = evento;
    const existe = await db.evento.findFirst({ where: { title: datos.title } });
    if (existe) continue;
    await db.evento.create({
      data: {
        ...datos,
        startDate: enDias(diasDesdeHoy, hora),
        endDate: diasFin ? enDias(diasFin, hora + 2) : null,
      },
    });
  }
  console.log(`   ${EVENTOS.length} eventos de agenda`);
}

// ---------------------------------------------------------------------------
// PUBLICACIONES
// ---------------------------------------------------------------------------

export const PUBLICACIONES = [
  {
    titulo: 'Boletín informativo n.º 12',
    descripcion: 'Crónica del curso, calendario de cultos y memoria de la vocalía de caridad.',
    categoria: TipoPublicacion.boletin,
    diasDesdeHoy: -20,
  },
  {
    titulo: 'Boletín informativo n.º 11',
    descripcion: 'Especial dedicado a la restauración del manto procesional.',
    categoria: TipoPublicacion.boletin,
    diasDesdeHoy: -200,
  },
  {
    titulo: 'Boletín informativo n.º 10',
    descripcion: 'Número de cuaresma con el cartel y el itinerario de la estación de penitencia.',
    categoria: TipoPublicacion.boletin,
    diasDesdeHoy: -380,
  },
  {
    titulo: 'Dossier de la estación de penitencia',
    descripcion: 'Normas, itinerario, horarios de paso y recomendaciones para los hermanos nazarenos.',
    categoria: TipoPublicacion.dossier,
    diasDesdeHoy: -150,
  },
  {
    titulo: 'Anuario 2025-2026',
    descripcion: 'Memoria gráfica y económica del ejercicio, con el balance aprobado en cabildo.',
    categoria: TipoPublicacion.anuario,
    diasDesdeHoy: -90,
  },
  {
    titulo: 'Apuntes para una historia del Grupo Parroquial',
    descripcion:
      'Recopilación documental sobre los orígenes de la devoción a los Desamparados en la parroquia.',
    categoria: TipoPublicacion.historia,
    diasDesdeHoy: -300,
  },
];

/**
 * PDF de relleno que acompaña a las publicaciones de ejemplo. El modelo exige
 * `archivoUrl`, así que antes se sembraba una ruta inventada y la web pública
 * ofrecía descargas que devolvían 404.
 *
 * El documento se guarda junto al seed y NO dentro de `storage/`, que está en
 * .gitignore por ser el destino de las subidas del CMS en tiempo de ejecución:
 * un despliegue que monte ahí un volumen vacío se lo llevaría por delante. El
 * seed lo instala en su sitio al sembrar, y el PDF real lo sustituye en cuanto
 * se sube desde el CMS.
 */
export const ARCHIVO_PUBLICACION_PENDIENTE = '/storage/public/documentos/pendiente.pdf';

/** El original versionado, del que sale la copia que sirve Express. */
export const ORIGEN_ARCHIVO_PENDIENTE = fileURLToPath(new URL('./activos/pendiente.pdf', import.meta.url));

/**
 * Deja el PDF de relleno donde `express.static` sirve `/storage/public`. La ruta
 * se calcula con `process.cwd()` igual que `publicStorageDir` en
 * upload.middleware; `seed-contenido.test.ts` comprueba que ambas coinciden.
 */
export function instalarArchivoPendiente() {
  const prefijo = '/storage/public/';
  const destino = path.join(process.cwd(), 'storage', 'public', ARCHIVO_PUBLICACION_PENDIENTE.slice(prefijo.length));
  mkdirSync(path.dirname(destino), { recursive: true });
  if (!existsSync(destino)) copyFileSync(ORIGEN_ARCHIVO_PENDIENTE, destino);
  return destino;
}

async function sembrarPublicaciones() {
  instalarArchivoPendiente();

  for (const publicacion of PUBLICACIONES) {
    const { diasDesdeHoy, ...datos } = publicacion;
    const existe = await db.publicacion.findFirst({ where: { titulo: datos.titulo } });
    if (existe) continue;
    await db.publicacion.create({
      data: {
        ...datos,
        // Marcador: sustituir por el PDF real subido desde el CMS.
        archivoUrl: ARCHIVO_PUBLICACION_PENDIENTE,
        imagenUrl: null,
        fecha: enDias(diasDesdeHoy, 10),
        visible: true,
      },
    });
  }
  console.log(`   ${PUBLICACIONES.length} publicaciones`);
}

// ---------------------------------------------------------------------------
// PÁGINAS DEL CMS
// ---------------------------------------------------------------------------

export const PAGINAS = [
  {
    slug: 'quienes-somos',
    titulo: 'Quiénes somos',
    contenido: `<p>El Grupo Parroquial de Nuestra Señora de los Desamparados es una asociación de fieles nacida en el seno de la Parroquia de los Padres Pasionistas de Málaga.</p>
<p>Su fin es dar culto público a la Santísima Virgen bajo la advocación de los Desamparados, promover la formación cristiana de sus hermanos y ejercer la caridad con los más necesitados de la barriada.</p>`,
  },
  {
    slug: 'hazte-hermano',
    titulo: 'Hazte hermano',
    contenido: `<p>Puede solicitar el ingreso cualquier persona bautizada que desee compartir la vida del Grupo Parroquial.</p>
<p>La solicitud se tramita desde esta web o presencialmente en la secretaría. Una vez admitida por la junta de gobierno, se comunica al interesado la fecha de imposición de la medalla.</p>`,
  },
  {
    slug: 'normativa-estacion-penitencia',
    titulo: 'Normativa de la estación de penitencia',
    contenido: `<p>El hermano nazareno debe presentarse con la túnica completa, la medalla de la corporación y calzado oscuro.</p>
<p>Se guardará silencio durante todo el recorrido y se seguirán en todo momento las indicaciones del diputado de tramo.</p>
<p>La papeleta de sitio es personal e intransferible y debe portarse durante toda la estación de penitencia.</p>`,
  },
  {
    slug: 'horario-secretaria',
    titulo: 'Horario de secretaría',
    contenido: `<p>La secretaría atiende de lunes a viernes, de 18:00 a 21:00, en la casa parroquial.</p>
<p>Durante la cuaresma el horario se amplía para el reparto de papeletas de sitio, según el calendario que se publica en el tablón y en esta web.</p>`,
  },
];

async function sembrarPaginas() {
  for (const pagina of PAGINAS) {
    await db.pagina.upsert({
      where: { slug: pagina.slug },
      update: {},
      create: pagina,
    });
  }
  console.log(`   ${PAGINAS.length} páginas del CMS`);
}

// ---------------------------------------------------------------------------
// ALBACERÍA: ENSERES Y ROPERO
// ---------------------------------------------------------------------------

export const ENSERES = [
  { nombre: 'Hachetas de alpaca', referencia: 'HAC-01', categoria: 'Iluminación', ubicacion: 'Almacén A, estante 1', cantidadOptimo: 18, cantidadBueno: 4, cantidadReparar: 2 },
  { nombre: 'Varales del palio', referencia: 'VAR-01', categoria: 'Paso', ubicacion: 'Almacén A, percha mural', cantidadOptimo: 10, cantidadBueno: 2, cantidadReparar: 0 },
  { nombre: 'Candelería del paso', referencia: 'CAN-01', categoria: 'Iluminación', ubicacion: 'Almacén A, estante 2', cantidadOptimo: 24, cantidadBueno: 6, cantidadReparar: 4 },
  { nombre: 'Faroles de cola', referencia: 'FAR-01', categoria: 'Iluminación', ubicacion: 'Almacén B', cantidadOptimo: 2, cantidadBueno: 0, cantidadReparar: 0 },
  { nombre: 'Insignias de tramo', referencia: 'INS-01', categoria: 'Cortejo', ubicacion: 'Almacén B, arcón', cantidadOptimo: 6, cantidadBueno: 3, cantidadReparar: 1 },
  { nombre: 'Bocinas', referencia: 'BOC-01', categoria: 'Cortejo', ubicacion: 'Almacén B, arcón', cantidadOptimo: 4, cantidadBueno: 0, cantidadReparar: 2 },
  { nombre: 'Ciriales', referencia: 'CIR-01', categoria: 'Cortejo', ubicacion: 'Sacristía', cantidadOptimo: 4, cantidadBueno: 2, cantidadReparar: 0 },
  { nombre: 'Respiraderos', referencia: 'RES-01', categoria: 'Paso', ubicacion: 'Almacén A, fondo', cantidadOptimo: 4, cantidadBueno: 0, cantidadReparar: 0 },
];

export const PRENDAS = [
  { numero: 'TUN-001', tipo: TipoPrenda.TUNICA, talla: '1.70m', estado: EstadoPrenda.DISPONIBLE },
  { numero: 'TUN-002', tipo: TipoPrenda.TUNICA, talla: '1.80m', estado: EstadoPrenda.DISPONIBLE },
  { numero: 'TUN-003', tipo: TipoPrenda.TUNICA, talla: '1.60m', estado: EstadoPrenda.TALLER, observaciones: 'Descosido en el bajo, pendiente de arreglo.' },
  { numero: 'CAP-001', tipo: TipoPrenda.CAPIROTE, talla: 'M', estado: EstadoPrenda.DISPONIBLE },
  { numero: 'CAP-002', tipo: TipoPrenda.CAPIROTE, talla: 'L', estado: EstadoPrenda.DISPONIBLE },
  { numero: 'FAR-001', tipo: TipoPrenda.FARAONA, talla: 'única', estado: EstadoPrenda.BAJA, observaciones: 'Retirada del uso por deterioro del tejido.' },
];

async function sembrarAlbaceria() {
  for (const enser of ENSERES) {
    const existe = await db.enser.findFirst({ where: { nombre: enser.nombre } });
    if (existe) continue;
    await db.enser.create({
      data: {
        ...enser,
        cantidadTotal: enser.cantidadOptimo + enser.cantidadBueno + enser.cantidadReparar,
      },
    });
  }

  for (const prenda of PRENDAS) {
    await db.prenda.upsert({
      where: { numero: prenda.numero },
      update: {},
      create: prenda,
    });
  }
  console.log(`   ${ENSERES.length} enseres y ${PRENDAS.length} prendas`);
}

// ---------------------------------------------------------------------------
// CONTABILIDAD
// ---------------------------------------------------------------------------

// Las dos primeras las crea sobre la marcha `recibo.service` al cobrar o
// devolver un recibo; sembrarlas aquí evita que el primer cobro real tenga que
// crearlas dentro de su transacción.
export const CATEGORIAS = [
  { nombre: 'Cuotas y papeletas', tipo: TipoTransaccion.INGRESO },
  { nombre: 'Devoluciones de recibos', tipo: TipoTransaccion.GASTO },
  { nombre: 'Donativos', tipo: TipoTransaccion.INGRESO },
  { nombre: 'Lotería y rifas', tipo: TipoTransaccion.INGRESO },
  { nombre: 'Culto y cera', tipo: TipoTransaccion.GASTO },
  { nombre: 'Flores y exorno', tipo: TipoTransaccion.GASTO },
  { nombre: 'Caridad', tipo: TipoTransaccion.GASTO },
  { nombre: 'Mantenimiento de enseres', tipo: TipoTransaccion.GASTO },
];

async function sembrarContabilidad() {
  for (const categoria of CATEGORIAS) {
    const existe = await db.categoriaTransaccion.findFirst({
      where: { nombre: categoria.nombre, tipo: categoria.tipo },
    });
    if (existe) continue;
    await db.categoriaTransaccion.create({ data: categoria });
  }
  console.log(`   ${CATEGORIAS.length} categorías de transacción`);
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FOTOS DE LA PORTADA
// ---------------------------------------------------------------------------

/**
 * Fotos de relleno para ver rotar la cabecera del inicio mientras el Grupo
 * Parroquial elige las suyas. Vienen de Wikimedia Commons con licencias
 * Creative Commons que obligan a citar al autor: si alguna se quedara en la
 * web real habría que acreditarla, aunque lo previsto es sustituirlas desde
 * el CMS (Portada). El seed no las repone si ya hay alguna foto guardada.
 */
export const IMAGENES_PORTADA = [
  {
    archivo: '01-amor-trono.webp',
    descripcion: 'Trono de palio de noche, con un nazareno de capirote blanco delante',
    autor: 'Pedro J Pacheco', licencia: 'CC BY-SA 4.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Amor_Trono_4.jpg',
  },
  {
    archivo: '02-dolores-virgen.webp',
    descripcion: 'Trono de palio dorado bajo los árboles, con la candelería encendida',
    autor: 'Pedro J Pacheco', licencia: 'CC BY-SA 4.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Dolores_-_Trono_de_la_Virgen.jpg',
  },
  {
    archivo: '03-malaga-nazarenos.webp',
    descripcion: 'Primer plano de un nazareno con el capirote de raso granate',
    autor: 'Sten Dueland', licencia: 'CC BY-SA 2.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Málaga_semana_santa_(17188297095).jpg',
  },
  {
    archivo: '04-penas-virgen.webp',
    descripcion: 'Trono de la Virgen bajo palio, con la orfebrería plateada iluminada',
    autor: 'Pedro J Pacheco', licencia: 'CC BY-SA 4.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Penas_-_Trono_de_la_Virgen_2.jpg',
  },
  {
    archivo: '05-desamparados-virgen.webp',
    descripcion: 'Nuestra Señora de los Desamparados en su trono, de día, a hombros de los portadores',
    autor: 'Jesusplaza02', licencia: 'CC BY-SA 3.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Nuestra_señora_de_los_Desamparados.jpg',
  },
  {
    archivo: '06-gitanos-maria.webp',
    descripcion: 'Lateral del trono de la Virgen con el palio granate y los portadores encapuchados',
    autor: 'Pedro J Pacheco', licencia: 'CC BY-SA 4.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Gitanos_-_Lateral_Trono_de_Maria.jpg',
  },
];

/** La ruta que se guarda en la base de datos y que valida portada.schema.ts. */
export const urlImagenPortada = (archivo: string) => `/storage/public/portada/${archivo}`;

/** Los originales versionados, de los que salen las copias que sirve Express. */
export const ORIGEN_IMAGENES_PORTADA = fileURLToPath(new URL('./activos/portada/', import.meta.url));

/**
 * Copia las fotos donde `express.static` sirve `/storage/public`, con el mismo
 * cálculo de ruta que `instalarArchivoPendiente` (y la misma costura probada).
 */
export function instalarImagenesPortada() {
  const carpeta = path.join(process.cwd(), 'storage', 'public', 'portada');
  mkdirSync(carpeta, { recursive: true });
  return IMAGENES_PORTADA.map((imagen) => {
    const destino = path.join(carpeta, imagen.archivo);
    if (!existsSync(destino)) copyFileSync(path.join(ORIGEN_IMAGENES_PORTADA, imagen.archivo), destino);
    return destino;
  });
}

export async function sembrarImagenesPortada() {
  // Solo con la tabla vacía: la lista la manda el CMS y el seed no debe pisarla.
  if ((await db.imagenPortada.count()) > 0) return;
  instalarImagenesPortada();
  await db.imagenPortada.createMany({
    data: IMAGENES_PORTADA.map((imagen, orden) => ({
      url: urlImagenPortada(imagen.archivo),
      descripcion: imagen.descripcion,
      orden,
    })),
  });
  console.log(`   ${IMAGENES_PORTADA.length} fotos de la portada`);
}

export async function sembrarContenido() {
  console.log('Sembrando contenido de ejemplo (editable desde el CMS):');
  await sembrarNoticias();
  await sembrarEventos();
  await sembrarPublicaciones();
  await sembrarImagenesPortada();
  await sembrarPaginas();
  await sembrarAlbaceria();
  await sembrarContabilidad();
}
