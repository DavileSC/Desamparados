/**
 * La cola de los envíos a muchos: los comunicados y el aviso de apertura de
 * papeletas (traspaso-2026-10-14 §5).
 *
 * El servicio de envío gratis deja un número de correos al día (Brevo, 300), y
 * un envío a todos los hermanos no cabe en uno. Aquí sale todo de uno en uno:
 * primero lo que va al móvil (no gasta correo y no tiene tope), y después los
 * correos, mientras quede cupo. Lo que no cabe espera al día siguiente sin que
 * nadie tenga que hacer nada. Los correos sueltos (un alta, una contraseña) no
 * pasan por aquí: salen siempre al momento, y por eso el tope por defecto
 * (250) deja margen.
 */
import { EstadoComunicado, EstadoEnvio, Prisma, TipoComunicado } from '@prisma/client';
import db from '../../config/db';
import { diaMadrid, diaMadridComoIntervalo } from '../../domain/contabilidad.js';
import { AvisosHermanosService } from '../avisos-hermanos.service.js';
import type { AvisoAHermano } from '../push.js';
import { enviarCorreo } from './envio.js';
import { RebotesService } from './rebotes.service.js';

/**
 * Dentro de `node --test`, sin tope ni pausa salvo que la prueba los ponga: la
 * base de pruebas acumula los envíos de cada vuelta del mismo día, y con el
 * tope de verdad la cola dejaba de enviar a la tercera; con la pausa, cada
 * apertura de plazo de las pruebas tardaba un minuto en vaciarse.
 */
const enPruebas = () => process.env.NODE_TEST_CONTEXT !== undefined;

/** Cuántos correos de la cola al día. El arranque valida CORREOS_MASIVOS_POR_DIA. */
export function topeDiario(): number {
  if (enPruebas() && process.env.CORREOS_MASIVOS_POR_DIA === undefined) return Number.MAX_SAFE_INTEGER;
  const valor = Number(process.env.CORREOS_MASIVOS_POR_DIA ?? 250);
  return Number.isInteger(valor) && valor > 0 ? valor : 250;
}

/** Entre correo y correo: el servicio corta a quien manda de golpe. */
function pausa(): number {
  if (enPruebas() && process.env.COMUNICADOS_PAUSA_MS === undefined) return 0;
  const ms = Number(process.env.COMUNICADOS_PAUSA_MS ?? 1500);
  return Number.isFinite(ms) && ms >= 0 ? ms : 1500;
}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Lo que salió hoy (día de Madrid) por correo: lo de la cola, de sus dos
 * tablas, y los sueltos que salen al momento (`envio.ts`). El tope del
 * servicio es uno para todo: contando solo la cola, un día de mucho envío se
 * gastaba el cupo entero y lo que fallaba después era una contraseña.
 */
export async function enviadosHoy(ahora: Date = new Date()): Promise<number> {
  const { desde } = diaMadridComoIntervalo(ahora);
  const donde = { estado: EstadoEnvio.ENVIADO, enviadoEl: { gte: desde } };
  const [comunicados, otros, sueltos] = await Promise.all([
    db.comunicadoEnvio.count({ where: donde }),
    db.correoEnCola.count({ where: donde }),
    db.correosSueltosDelDia.findUnique({ where: { dia: diaMadrid(ahora) }, select: { enviados: true } }),
  ]);
  return comunicados + otros + (sueltos?.enviados ?? 0);
}

/**
 * Los lotes del aviso previo del cargo de una remesa («remesa:12»). Salen
 * delante de todo lo demás: la norma pide avisar con antelación del cargo, y
 * detrás de un boletín a todos los hermanos el aviso esperaba días.
 */
export const LOTE_AVISO_DE_CARGO = 'remesa:';

/** Los avisos de cargo que aún esperan su correo: los que la previa de una remesa tiene delante. */
export const avisosDeCargoPendientes = () =>
  db.correoEnCola.count({ where: { estado: EstadoEnvio.PENDIENTE, porMovil: false, lote: { startsWith: LOTE_AVISO_DE_CARGO } } });

/**
 * Cómo se maqueta y avisa un comunicado: lo pone `comunicados.service`, que es
 * quien sabe hacerlo. Así esta cola no lo importa y no hay un ciclo.
 */
export interface DelComunicado {
  correo(c: { tipo: TipoComunicado; asunto: string; cuerpo: string }, d: { email: string; nombre: string | null; sexo: 'HOMBRE' | 'MUJER' | null }): string;
  /** Las cabeceras propias de ese correo (la baja en un clic, solo en el boletín). */
  cabeceras(c: { tipo: TipoComunicado }, email: string): Record<string, string> | undefined;
  aviso(c: { id: number; asunto: string; cuerpo: string }): Omit<AvisoAHermano, 'tipo'>;
}
let delComunicado: DelComunicado | null = null;
export function ponerMaquetaDeComunicados(m: DelComunicado): void {
  delComunicado = m;
}

/**
 * El PDF que lleva un correo de la cola, hecho al enviarlo: la fila guarda
 * solo de qué es (`adjunto`), no cientos de PDF. Cada tipo lo pone el
 * servicio que sabe hacerlo, como la maqueta de los comunicados.
 */
export interface AdjuntoDeLaCola { tipo: string }
type Adjunto = { filename: string; content: Buffer; contentType: string };
const fabricasDeAdjuntos = new Map<string, (a: AdjuntoDeLaCola) => Promise<Adjunto>>();
export function ponerFabricaDeAdjuntos(tipo: string, fabrica: (a: AdjuntoDeLaCola) => Promise<Adjunto>): void {
  fabricasDeAdjuntos.set(tipo, fabrica);
}

// --- Los dos pasos ------------------------------------------------------------

/**
 * Lo que va al móvil, sin tope. Si a la cuenta no le llega a ningún móvil
 * (los quitó, o el servicio no responde), se queda como correo.
 */
async function avisosAlMovil(): Promise<void> {
  for (;;) {
    const envio = await db.comunicadoEnvio.findFirst({
      where: { estado: EstadoEnvio.PENDIENTE, porMovil: true, comunicado: { estado: EstadoComunicado.ENVIANDO } },
      include: { comunicado: { select: { id: true, asunto: true, cuerpo: true } } },
      orderBy: { id: 'asc' },
    });
    if (!envio) break;
    const llego = envio.userId !== null && delComunicado !== null
      && (await AvisosHermanosService.avisarALaCuenta(envio.userId, delComunicado.aviso(envio.comunicado)));
    await db.comunicadoEnvio.update({
      where: { id: envio.id },
      data: llego ? { estado: EstadoEnvio.MOVIL, enviadoEl: new Date() } : { porMovil: false },
    });
    if (llego) await cerrarSiTermino(envio.comunicadoId);
  }
  for (;;) {
    const envio = await db.correoEnCola.findFirst({ where: { estado: EstadoEnvio.PENDIENTE, porMovil: true }, orderBy: { id: 'asc' } });
    if (!envio) break;
    const aviso = envio.aviso as Omit<AvisoAHermano, 'tipo'> | null;
    const llego = envio.userId !== null && aviso !== null && (await AvisosHermanosService.avisarALaCuenta(envio.userId, aviso));
    await db.correoEnCola.update({
      where: { id: envio.id },
      data: llego ? { estado: EstadoEnvio.MOVIL, enviadoEl: new Date() } : { porMovil: false },
    });
  }
}

/** Un comunicado sin nada pendiente ya está enviado. */
async function cerrarSiTermino(comunicadoId: number): Promise<void> {
  const quedan = await db.comunicadoEnvio.count({ where: { comunicadoId, estado: EstadoEnvio.PENDIENTE } });
  if (quedan === 0) await db.comunicado.updateMany({ where: { id: comunicadoId, estado: EstadoComunicado.ENVIANDO }, data: { estado: EstadoComunicado.ENVIADO } });
}

/**
 * Quita de la cola los envíos pendientes que ya no deben salir y cierra los
 * comunicados que se quedan sin nada pendiente (si no, seguirían «enviándose»
 * para siempre). Lo usan la baja del boletín, que con el tope del día podía
 * llegar mientras el boletín aún esperaba, y la supresión de la cuenta.
 */
export async function retirarPendientes(donde: Prisma.ComunicadoEnvioWhereInput, dondeOtros?: Prisma.CorreoEnColaWhereInput): Promise<void> {
  const afectados = await db.comunicadoEnvio.findMany({ where: { ...donde, estado: EstadoEnvio.PENDIENTE }, select: { comunicadoId: true }, distinct: ['comunicadoId'] });
  await db.comunicadoEnvio.deleteMany({ where: { ...donde, estado: EstadoEnvio.PENDIENTE } });
  if (dondeOtros) await db.correoEnCola.deleteMany({ where: { ...dondeOtros, estado: EstadoEnvio.PENDIENTE } });
  for (const { comunicadoId } of afectados) await cerrarSiTermino(comunicadoId);
}

/** Quien deja el boletín (por el enlace o por el aviso de Brevo) no recibe el que aún espera en la cola. */
export const retirarBoletinesPendientes = (email: string) =>
  retirarPendientes({ email: email.trim().toLowerCase(), comunicado: { tipo: TipoComunicado.BOLETIN } });

/**
 * Los fallidos de un lote de la cola (la apertura de papeletas, los
 * recordatorios) vuelven a esperar turno. Si el servicio de correo se cae a
 * mitad, todo lo que quedaba sale fallido; los comunicados tenían su
 * «Reintentar», los lotes no. Devuelve cuántos.
 */
export async function reintentarLote(lote: string): Promise<number> {
  const { count } = await db.correoEnCola.updateMany({ where: { lote, estado: EstadoEnvio.FALLIDO }, data: { estado: EstadoEnvio.PENDIENTE, enviadoEl: null } });
  if (count > 0) void despertarCola();
  return count;
}

/**
 * El siguiente correo, el más antiguo de las dos tablas: una apertura puesta
 * en cola antes que un comunicado sale antes. false si no queda ninguno.
 *
 * A una dirección que el servicio de envío dio por perdida no se le manda: el
 * servicio la tiene bloqueada y el intento solo gastaría cupo. Queda como
 * «Rebotó» y no cuenta para el tope del día.
 */
async function siguienteCorreo(): Promise<boolean> {
  // El aviso de un cargo en cuenta, antes que nada (ver LOTE_AVISO_DE_CARGO).
  const deCargo = await db.correoEnCola.findFirst({
    where: { estado: EstadoEnvio.PENDIENTE, porMovil: false, lote: { startsWith: LOTE_AVISO_DE_CARGO } },
    orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
  });
  if (deCargo) {
    await enviarDeLaCola(deCargo);
    return true;
  }
  const [comunicado, otro] = await Promise.all([
    db.comunicadoEnvio.findFirst({
      where: { estado: EstadoEnvio.PENDIENTE, porMovil: false, comunicado: { estado: EstadoComunicado.ENVIANDO } },
      include: { comunicado: { select: { id: true, tipo: true, asunto: true, cuerpo: true } } },
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
    }),
    db.correoEnCola.findFirst({ where: { estado: EstadoEnvio.PENDIENTE, porMovil: false }, orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] }),
  ]);
  if (comunicado && delComunicado && (!otro || comunicado.creadoEn <= otro.creadoEn)) {
    const estado = (await RebotesService.rebota(comunicado.email))
      ? EstadoEnvio.REBOTADO
      : (await enviarCorreo(comunicado.email, comunicado.comunicado.asunto, delComunicado.correo(comunicado.comunicado, comunicado), {
        uso: 'comunicado', cabeceras: delComunicado.cabeceras(comunicado.comunicado, comunicado.email),
        desdeLaCola: true,
      })) ? EstadoEnvio.ENVIADO : EstadoEnvio.FALLIDO;
    await db.comunicadoEnvio.update({ where: { id: comunicado.id }, data: { estado, enviadoEl: new Date() } });
    await cerrarSiTermino(comunicado.comunicadoId);
    return true;
  }
  if (otro) {
    await enviarDeLaCola(otro);
    return true;
  }
  return false;
}

async function enviarDeLaCola(envio: { id: number; para: string; asunto: string; html: string; uso: string; adjunto: Prisma.JsonValue }): Promise<void> {
  let estado: EstadoEnvio = EstadoEnvio.REBOTADO;
  if (!(await RebotesService.rebota(envio.para))) {
    const adjuntos = await adjuntosDe(envio);
    const enviado = adjuntos !== null && (await enviarCorreo(envio.para, envio.asunto, envio.html, { uso: envio.uso, desdeLaCola: true, adjuntos }));
    estado = enviado ? EstadoEnvio.ENVIADO : EstadoEnvio.FALLIDO;
  }
  await db.correoEnCola.update({ where: { id: envio.id }, data: { estado, enviadoEl: new Date() } });
}

/**
 * El PDF del correo, o `null` si no se puede hacer (el certificado ya no
 * sale, o falta quien lo haga): entonces el correo no sale sin él, queda
 * fallido con su «Reintentar» y la cola sigue con los demás.
 */
async function adjuntosDe(envio: { id: number; adjunto: Prisma.JsonValue }): Promise<Adjunto[] | null> {
  if (envio.adjunto === null) return [];
  const adjunto = envio.adjunto as unknown as AdjuntoDeLaCola;
  const fabrica = fabricasDeAdjuntos.get(adjunto.tipo);
  try {
    if (!fabrica) throw new Error(`no hay quien haga el adjunto «${adjunto.tipo}»`);
    return [await fabrica(adjunto)];
  } catch (error) {
    console.error(`❌ [Cola de correos] El correo ${envio.id} no sale: sin su adjunto.`, error);
    return null;
  }
}

// --- El repartidor ----------------------------------------------------------

let enMarcha: Promise<void> | null = null;
let otraVuelta = false;

async function repartir(): Promise<void> {
  do {
    otraVuelta = false;
    await avisosAlMovil();
    while ((await enviadosHoy()) < topeDiario()) {
      if (!(await siguienteCorreo())) break;
      // Algo nuevo para el móvil no espera a que acaben los correos.
      if (otraVuelta) break;
      if (pausa() > 0) await esperar(pausa());
    }
  } while (otraVuelta);
}

/**
 * Pone a repartir lo pendiente. Solo hay un repartidor: si ya está en marcha,
 * da otra vuelta al acabar (lo nuevo puede ser para el móvil, que va primero).
 * Devuelve la promesa del que está en marcha, para que las pruebas esperen.
 */
export function despertarCola(): Promise<void> {
  if (enMarcha) {
    otraVuelta = true;
    return enMarcha;
  }
  enMarcha = (async () => {
    try {
      await repartir();
    } catch (error) {
      // Un fallo de la base no debe tumbar el servidor: lo pendiente sigue
      // apuntado y se retoma en la siguiente vuelta.
      console.error('❌ [Cola de correos] El envío se ha detenido:', error);
    } finally {
      enMarcha = null;
    }
  })();
  return enMarcha;
}

/** Lo ya enviado de la cola se borra al mes: lleva el correo entero maquetado. La cuenta de los sueltos, también. */
async function limpiar(ahora: Date = new Date()): Promise<void> {
  const haceUnMes = new Date(ahora.getTime() - 30 * 24 * 3600 * 1000);
  await db.correoEnCola.deleteMany({
    where: { estado: { in: [EstadoEnvio.ENVIADO, EstadoEnvio.MOVIL, EstadoEnvio.REBOTADO] }, enviadoEl: { lt: haceUnMes } },
  });
  await db.correosSueltosDelDia.deleteMany({ where: { dia: { lt: diaMadrid(haceUnMes) } } });
}

/**
 * Al arrancar el servidor: sigue lo que quedó a medias y vuelve a mirar cada
 * diez minutos, que es como lo que esperaba al día siguiente sale solo.
 */
export function arrancarCola(): void {
  void despertarCola();
  const reloj = setInterval(() => {
    void despertarCola();
    limpiar().catch((error) => console.error('❌ [Cola de correos] No se pudo limpiar lo enviado:', error));
  }, 10 * 60 * 1000);
  reloj.unref();
}

/** Para las pruebas: esperar a que el repartidor en marcha termine. */
export const colaTerminada = (): Promise<void> => enMarcha ?? Promise.resolve();

// --- Lo que ve el CMS ---------------------------------------------------------

export type EstadoDelEnvio = 'EN_COLA' | 'ENVIANDO' | 'SIGUE_MANANA' | 'TERMINADO';

interface Cuentas { alMovil: number; enviados: number; fallidos: number; rebotados: number; pendientes: number }

function estadoDe(c: Cuentas, cupoAgotado: boolean): EstadoDelEnvio {
  if (c.pendientes === 0) return 'TERMINADO';
  if (cupoAgotado) return 'SIGUE_MANANA';
  return c.alMovil + c.enviados + c.fallidos + c.rebotados === 0 ? 'EN_COLA' : 'ENVIANDO';
}

const contar = (filas: { estado: EstadoEnvio; _count: { _all: number } }[]): Cuentas => {
  const de = (e: EstadoEnvio) => filas.find((f) => f.estado === e)?._count._all ?? 0;
  return { alMovil: de(EstadoEnvio.MOVIL), enviados: de(EstadoEnvio.ENVIADO), fallidos: de(EstadoEnvio.FALLIDO), rebotados: de(EstadoEnvio.REBOTADO), pendientes: de(EstadoEnvio.PENDIENTE) };
};

/**
 * Los correos de hoy frente al tope, y los envíos a muchos: los que están en
 * marcha y los acabados en la última semana, en marcha primero.
 */
export async function resumenDeEnvios(ahora: Date = new Date()) {
  const semana = new Date(ahora.getTime() - 7 * 24 * 3600 * 1000);
  const [enviados, tope] = [await enviadosHoy(ahora), topeDiario()];
  const cupoAgotado = enviados >= tope;

  const comunicados = await db.comunicado.findMany({
    where: { OR: [{ estado: EstadoComunicado.ENVIANDO }, { estado: EstadoComunicado.ENVIADO, enviadoEl: { gte: semana } }] },
    select: { id: true, asunto: true, enviadoEl: true },
  });
  const porComunicado = await db.comunicadoEnvio.groupBy({
    by: ['comunicadoId', 'estado'], where: { comunicadoId: { in: comunicados.map((c) => c.id) } }, _count: { _all: true },
  });
  // Los lotes con algo pendiente o de esta semana, y de ellos todas sus filas:
  // contar solo las recientes dejaba fuera lo ya enviado de un lote largo.
  const vivos = await db.correoEnCola.findMany({
    where: { OR: [{ estado: EstadoEnvio.PENDIENTE }, { creadoEn: { gte: semana } }, { enviadoEl: { gte: semana } }] },
    select: { lote: true }, distinct: ['lote'],
  });
  const lotes = await db.correoEnCola.groupBy({
    by: ['lote', 'estado'], where: { lote: { in: vivos.map((v) => v.lote) } }, _count: { _all: true }, _min: { creadoEn: true },
  });
  const nombres = new Map((await db.correoEnCola.findMany({
    where: { lote: { in: [...new Set(lotes.map((l) => l.lote))] } }, select: { lote: true, titulo: true }, distinct: ['lote'],
  })).map((l) => [l.lote, l.titulo]));

  const envios = [
    ...comunicados.map((c) => {
      const cuentas = contar(porComunicado.filter((f) => f.comunicadoId === c.id));
      return { clave: `comunicado:${c.id}`, tipo: 'comunicado' as const, titulo: c.asunto, desde: c.enviadoEl ?? ahora, ...cuentas };
    }),
    ...[...new Set(lotes.map((l) => l.lote))].map((lote) => {
      const filas = lotes.filter((l) => l.lote === lote);
      const desde = filas.reduce<Date>((min, f) => (f._min.creadoEn && f._min.creadoEn < min ? f._min.creadoEn : min), ahora);
      return { clave: lote, tipo: 'apertura' as const, titulo: nombres.get(lote) ?? lote, desde, ...contar(filas) };
    }),
  ].map(({ desde, ...e }) => ({
    ...e,
    desde: desde.toISOString(),
    total: e.alMovil + e.enviados + e.fallidos + e.rebotados + e.pendientes,
    estado: estadoDe(e, cupoAgotado),
  }));
  envios.sort((a, b) => Number(a.estado === 'TERMINADO') - Number(b.estado === 'TERMINADO') || b.desde.localeCompare(a.desde));
  return { hoy: { enviados, tope }, envios };
}
