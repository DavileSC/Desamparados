// prisma/seed-contenido.ts
//
// Contenido de ejemplo para poder ver la web y el CMS llenos mientras la
// corporación prepara los textos definitivos. TODO es inventado y está pensado
// para editarse desde el CMS: nada de esto pretende ser información real.
//
// Es de cualquier corporación, no de una: en producción se siembra en la
// instalación de cada cliente (tablas vacías), así que no nombra templo,
// ciudad, calles ni salida. La corporación y su Titular salen de
// instalacion/datos-entidad.json (domain/articulos.ts), como en el código; lo
// propio de cada una lo escribe ella después desde el CMS.
//
// Es idempotente: se puede ejecutar tantas veces como haga falta sin duplicar
// nada. Los modelos con clave única usan `upsert`; los que no la tienen se
// comprueban por título o nombre antes de crearse.

import {
  TipoEvento,
  TipoPublicacion,
  TipoPrenda,
  EstadoPrenda,
  TipoTransaccion,
} from '@prisma/client';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { completarVariantes, FOTO_DE_PORTADA } from '../src/utils/variantes-publicas';
import { MAX_IMAGENES_PORTADA } from '../src/schemas/portada.schema';
import db from '../src/config/db';
import { SLUGS_CONTENIDO } from '../src/domain/contenido';
import { sembrarPaginasQueFalten } from '../src/domain/contenido-inicial';
import { identidad } from '../src/domain/datos-entidad';
import { deLaCorporacion, laCorporacion, mayuscula, segunLaCorporacion } from '../src/domain/articulos';

// La corporación como sujeto al empezar frase («El Grupo Parroquial», «La
// Hermandad»), con el verbo que concuerda con su número.
const LaCorporacion = mayuscula(laCorporacion());
const verbo = (singular: string, plural: string) => segunLaCorporacion(singular, plural);

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
    titulo: 'Eucaristía de inicio de las actividades',
    extracto:
      `${LaCorporacion} ${verbo('retoma', 'retoman')} su actividad con una eucaristía de acción de gracias y la presentación del calendario de cultos.`,
    contenido: `<p>El próximo sábado tendrá lugar la eucaristía de inicio de las actividades, presidida por nuestro director espiritual en la sede canónica.</p>
<p>Durante la celebración se presentará el calendario de cultos y actividades que nos acompañará hasta la próxima salida procesional, y se dará la bienvenida a los hermanos incorporados durante el verano.</p>
<p>Al término de la misa habrá una convivencia en el salón parroquial. Se invita a todos los hermanos y a sus familias a participar.</p>`,
    diasDesdeHoy: -3,
  },
  {
    slug: 'solemne-triduo',
    titulo: `Solemne triduo en honor de ${identidad.titular}`,
    extracto:
      'Tres jornadas de oración ante la imagen titular, con predicación a cargo del equipo de formación.',
    contenido: `<p>Como cada año, ${laCorporacion()} ${verbo('celebra', 'celebran')} solemne triduo en honor de ${identidad.titular}.</p>
<p>Los cultos darán comienzo a las 19:30 con el rezo del santo rosario, seguido de la eucaristía y el ejercicio del triduo. La última jornada concluirá con un acto de veneración a la imagen titular.</p>
<p>Se ruega a los hermanos que acudan con la medalla de la corporación.</p>`,
    diasDesdeHoy: -12,
  },
  {
    slug: 'campana-alimentos',
    titulo: 'Campaña de recogida de alimentos',
    extracto:
      'La vocalía de caridad organiza la recogida anual de alimentos no perecederos en beneficio de las familias atendidas por la parroquia.',
    contenido: `<p>La vocalía de caridad pone en marcha un año más la campaña de recogida de alimentos no perecederos.</p>
<p>Los donativos pueden entregarse en la sede durante el horario de secretaría. Se necesitan especialmente leche, conservas, legumbre cocida, aceite y alimentación infantil.</p>
<p>Lo recogido se repartirá a través de Cáritas parroquial entre las familias del barrio.</p>`,
    diasDesdeHoy: -25,
  },
  {
    slug: 'restauracion-manto-procesional',
    titulo: 'Concluye la restauración del manto procesional',
    extracto:
      'El taller de bordado ha devuelto el manto a su estado original tras seis meses de trabajo sobre el terciopelo y la malla de sujeción.',
    contenido: `<p>Ha concluido la restauración del manto procesional, que se encontraba en el taller desde el pasado mes de febrero.</p>
<p>La intervención ha consistido en el paso del bordado a un terciopelo nuevo, la consolidación de las piezas más deterioradas y la reposición de las hojillas perdidas.</p>
<p>El manto podrá contemplarse en el próximo acto de veneración a la imagen titular.</p>`,
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
      `Una veintena de hermanos de entre 14 y 25 años forman el nuevo grupo joven ${deLaCorporacion()}.`,
    contenido: `<p>Queda constituido oficialmente el grupo joven, formado por una veintena de hermanos de entre 14 y 25 años.</p>
<p>Su labor se centrará en la formación, la participación en los cultos y la colaboración en las actividades caritativas, con reuniones quincenales los viernes por la tarde.</p>
<p>Los interesados en incorporarse pueden escribir a la secretaría ${deLaCorporacion()}.</p>`,
    diasDesdeHoy: -70,
  },
  {
    slug: 'reparto-papeletas-sitio',
    titulo: 'Calendario de reparto de papeletas de sitio',
    extracto:
      'Se publica el calendario de reparto de papeletas para la próxima estación de penitencia.',
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
    contenido: `<p>Una familia de hermanos ha donado seis hachetas de alpaca plateada que pasan a formar parte del patrimonio ${deLaCorporacion()}.</p>
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
    title: 'Eucaristía de inicio de las actividades',
    description: 'Celebración de acción de gracias con presentación del calendario de cultos.',
    location: 'Sede canónica',
    diasDesdeHoy: 5,
    hora: 19,
    type: TipoEvento.CULTO,
  },
  {
    title: 'Reunión de la junta de gobierno',
    description: 'Sesión ordinaria mensual de la junta de gobierno.',
    location: 'Sede, sala de juntas',
    diasDesdeHoy: 9,
    hora: 20,
    type: TipoEvento.REUNION,
  },
  {
    title: 'Catequesis de adultos: el año litúrgico',
    description: 'Primera sesión del itinerario formativo abierto a hermanos y devotos.',
    location: 'Salón parroquial',
    diasDesdeHoy: 14,
    hora: 19,
    type: TipoEvento.FORMACION,
  },
  {
    title: 'Convivencia del grupo joven',
    description: 'Tarde de convivencia y juegos para los hermanos más jóvenes.',
    location: 'Patio parroquial',
    diasDesdeHoy: 21,
    hora: 17,
    type: TipoEvento.SOCIAL,
  },
  {
    title: 'Solemne triduo',
    description: `Rosario, eucaristía y ejercicio del triduo en honor de ${identidad.titular}, cada una de las tres jornadas.`,
    location: 'Sede canónica',
    diasDesdeHoy: 40,
    diasFin: 42,
    hora: 19,
    type: TipoEvento.CULTO,
  },
  {
    title: 'Veneración a la imagen titular',
    description: `Jornada de veneración ante la imagen de ${identidad.titular}.`,
    location: 'Sede canónica',
    diasDesdeHoy: 43,
    hora: 11,
    type: TipoEvento.CULTO,
  },
  {
    title: 'Cabildo general ordinario de hermanos',
    description: 'Cuentas del ejercicio, memoria de actividades y ruegos y preguntas.',
    location: 'Salón parroquial',
    diasDesdeHoy: 60,
    hora: 19,
    type: TipoEvento.REUNION,
  },
  {
    title: 'Reparto de papeletas de sitio',
    description: 'Atención presencial en secretaría por orden de antigüedad.',
    location: 'Sede, secretaría',
    diasDesdeHoy: 150,
    diasFin: 160,
    hora: 18,
    type: TipoEvento.OTRO,
  },
  {
    title: 'Ensayo general de portadores',
    description: 'Último ensayo antes de la estación de penitencia. Obligatoria la asistencia.',
    location: 'Explanada de la parroquia',
    diasDesdeHoy: 195,
    hora: 21,
    type: TipoEvento.ENSAYO,
  },
  {
    title: 'Estación de penitencia',
    description: `Salida procesional de ${identidad.titular} por las calles de su feligresía.`,
    location: 'Desde la sede canónica',
    diasDesdeHoy: 204,
    hora: 18,
    type: TipoEvento.PROCESION,
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
    descripcion: 'Crónica del año, calendario de cultos y memoria de la vocalía de caridad.',
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
    titulo: 'Anuario 2025',
    descripcion: 'Memoria gráfica y económica del ejercicio, con el balance aprobado en cabildo.',
    categoria: TipoPublicacion.anuario,
    diasDesdeHoy: -90,
  },
  {
    titulo: 'Apuntes para una historia de la corporación',
    descripcion:
      `Recopilación documental sobre los orígenes de la devoción a ${identidad.titular} en la parroquia.`,
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
    contenido: `<p>${LaCorporacion} ${verbo('es una asociación', 'son asociaciones')} de fieles ${verbo('nacida', 'nacidas')} en el seno de su parroquia.</p>
<p>Su fin es dar culto público a ${identidad.titular}, promover la formación cristiana de sus hermanos y ejercer la caridad con los más necesitados del barrio.</p>`,
  },
  {
    slug: 'hazte-hermano',
    titulo: 'Hazte hermano',
    contenido: `<p>Puede solicitar el ingreso cualquier persona bautizada que desee compartir la vida ${deLaCorporacion()}.</p>
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
    contenido: `<p>La secretaría atiende el primer viernes de cada mes, de 19:30 a 21:00, en la sede.</p>
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
  { nombre: 'Varales',referencia: 'VAR-01', categoria: 'Paso', ubicacion: 'Almacén A, percha mural', cantidadOptimo: 10, cantidadBueno: 2, cantidadReparar: 0 },
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
      where: { tipo_numero: { tipo: prenda.tipo, numero: prenda.numero } },
      update: {},
      create: prenda,
    });
  }
  console.log(`   ${ENSERES.length} enseres y ${PRENDAS.length} prendas`);
}

// ---------------------------------------------------------------------------
// CONTABILIDAD
// ---------------------------------------------------------------------------

// Las de los recibos (ver CATEGORIAS_DE_RECIBOS) las crean también sobre la
// marcha los cobros y las devoluciones; sembrarlas aquí evita que el primer
// cobro real tenga que crearlas. «Donativos» es a la vez de los recibos de
// donativo y de los apuntes a mano.
export const CATEGORIAS = [
  { nombre: 'Cuotas de hermanos', tipo: TipoTransaccion.INGRESO },
  { nombre: 'Papeletas de sitio', tipo: TipoTransaccion.INGRESO },
  { nombre: 'Otros recibos', tipo: TipoTransaccion.INGRESO },
  { nombre: 'Devoluciones de recibos', tipo: TipoTransaccion.GASTO },
  { nombre: 'Comisiones bancarias', tipo: TipoTransaccion.GASTO },
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
 * Las fotos con que arranca la cabecera del inicio, para que rote desde el
 * primer día; se cambian desde el CMS (Portada). Son de cada corporación, así
 * que no están en git: la siembra las toma de `instalacion/imagenes/portada/`
 * (fuera de git, como datos-entidad.json; en el contenedor, el mismo montaje).
 * Sin esa carpeta, la portada se siembra sin fotos y la Junta las sube desde
 * el CMS: unas fotos de otra corporación no pueden llegarle a un cliente
 * nuevo. Una foto ajena (de Commons, de otra corporación) tampoco entra ahí:
 * saldría sin el crédito que su licencia exige (docs/venta/licencias.md).
 *
 * Valen las que tengan la forma de `FOTO_DE_PORTADA` (`01-rostro.webp`): son
 * las únicas a las que `completarVariantes` hace copias, y el número fija el
 * orden. El texto alternativo sale de `descripciones.json` en la misma carpeta
 * ({ "01-rostro.webp": "…" }) o, si falta, del nombre del fichero.
 */
export const ORIGEN_IMAGENES_PORTADA = fileURLToPath(new URL('../../instalacion/imagenes/portada/', import.meta.url));

export interface ImagenPortadaSembrada {
  archivo: string;
  descripcion: string;
}

// Lo que admite portada.schema.ts para la descripción, que es el texto alternativo.
const descripcionValida = (texto: unknown): texto is string =>
  typeof texto === 'string' && texto.trim().length > 0 && texto.length <= 200 && !/[<>]/.test(texto);

/** «02-trono-en-la-calle.webp» → «Trono en la calle»: mejor que una foto sin texto alternativo. */
const descripcionDelNombre = (archivo: string) =>
  mayuscula(archivo.replace(/\.webp$/i, '').replace(/^\d{2}-/, '').replace(/-/g, ' '));

/** Las fotos de partida de esta instalación, en orden; ninguna si no tiene carpeta. */
export function imagenesPortada(carpeta = ORIGEN_IMAGENES_PORTADA): ImagenPortadaSembrada[] {
  if (!existsSync(carpeta)) return [];
  let descripciones: Record<string, unknown> = {};
  const fichero = path.join(carpeta, 'descripciones.json');
  if (existsSync(fichero)) {
    // Un JSON roto no debe tumbar la siembra entera: se avisa y se tira del nombre.
    try {
      descripciones = JSON.parse(readFileSync(fichero, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      console.warn(`   (aviso: ${fichero} no es un JSON válido; las fotos llevan de texto su nombre)`);
    }
  }
  return readdirSync(carpeta)
    .filter((archivo) => FOTO_DE_PORTADA.test(archivo))
    .sort()
    .slice(0, MAX_IMAGENES_PORTADA)
    .map((archivo) => ({
      archivo,
      descripcion: descripcionValida(descripciones[archivo]) ? descripciones[archivo] : descripcionDelNombre(archivo),
    }));
}

/** La ruta que se guarda en la base de datos y que valida portada.schema.ts. */
export const urlImagenPortada = (archivo: string) => `/storage/public/portada/${archivo}`;

/**
 * Copia las fotos donde `express.static` sirve `/storage/public`, con el mismo
 * cálculo de ruta que `instalarArchivoPendiente` (y la misma costura probada).
 */
export function instalarImagenesPortada(imagenes = imagenesPortada(), origen = ORIGEN_IMAGENES_PORTADA) {
  const carpeta = path.join(process.cwd(), 'storage', 'public', 'portada');
  mkdirSync(carpeta, { recursive: true });
  return imagenes.map((imagen) => {
    const destino = path.join(carpeta, imagen.archivo);
    if (!existsSync(destino)) copyFileSync(path.join(origen, imagen.archivo), destino);
    return destino;
  });
}

export async function sembrarImagenesPortada() {
  // Solo con la tabla vacía: la lista la manda el CMS y el seed no debe pisarla.
  if ((await db.imagenPortada.count()) > 0) return;
  const imagenes = imagenesPortada();
  if (imagenes.length === 0) {
    console.log(`   (portada: sin fotos de partida en ${ORIGEN_IMAGENES_PORTADA}; se suben desde el CMS)`);
    return;
  }
  instalarImagenesPortada(imagenes);
  // Con sus copias de 640 y 1280: van a pantalla completa en la primera visita.
  await completarVariantes({ directorio: path.join(process.cwd(), 'storage', 'public') });
  await db.imagenPortada.createMany({
    data: imagenes.map((imagen, orden) => ({
      url: urlImagenPortada(imagen.archivo),
      descripcion: imagen.descripcion,
      orden,
    })),
  });
  console.log(`   ${imagenes.length} fotos de la portada`);
}

/**
 * Crea las páginas editables que falten: con la semilla de la instalación
 * (instalacion/contenido-inicial.json) si la trae y, si no, con el contenido
 * neutro de partida. Lo mismo que hace el arranque de la API, y por el mismo
 * camino (`sembrarPaginasQueFalten`). Idempotente y **sin `update`**: volver a
 * sembrar no puede deshacer lo que alguien haya editado desde el CMS.
 */
export async function sembrarContenidoPaginas() {
  const { conSemilla, neutras } = await sembrarPaginasQueFalten();
  console.log(
    `   ${SLUGS_CONTENIDO.length} páginas de contenido editable` +
    (conSemilla.length || neutras.length ? ` (nuevas: ${conSemilla.length} con la semilla, ${neutras.length} con el contenido de partida)` : ''),
  );
}

/**
 * `soloTablasVacias` (producción): los ejemplos se siembran solo donde no hay
 * nada, es decir, en la instalación. Creando «lo que falte» por slug o título,
 * volver a sembrar en un despliegue posterior devolvía a la web las noticias
 * ficticias y los enseres de ejemplo que la Junta ya había borrado.
 */
export async function sembrarContenido({ soloTablasVacias = false } = {}) {
  console.log('Sembrando contenido de ejemplo (editable desde el CMS):');
  const toca = async (nombre: string, cuantas: Promise<number>) => {
    if (!soloTablasVacias || (await cuantas) === 0) return true;
    console.log(`   (${nombre}: ya hay contenido, no se siembran ejemplos)`);
    return false;
  };
  if (await toca('noticias', db.noticia.count())) await sembrarNoticias();
  if (await toca('agenda', db.evento.count())) await sembrarEventos();
  if (await toca('publicaciones', db.publicacion.count())) await sembrarPublicaciones();
  await sembrarImagenesPortada();
  await sembrarContenidoPaginas();
  if (await toca('páginas del CMS', db.pagina.count())) await sembrarPaginas();
  if (await toca('enseres y prendas', Promise.all([db.enser.count(), db.prenda.count()]).then(([a, b]) => a + b))) await sembrarAlbaceria();
  await sembrarContabilidad();
}
