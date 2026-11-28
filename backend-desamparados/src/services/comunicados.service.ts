/**
 * El boletín y los avisos masivos por correo: el borrador, a quién va, la
 * prueba, el envío y la baja del boletín.
 *
 * Enviar no manda nada en el acto: apunta a cada destinatario y la cola de
 * correos (`correos/cola.ts`) los va mandando uno a uno, con pausa y con los
 * topes de la hora y del día. Si el servidor se reinicia a medias, sigue por
 * donde iba.
 *
 * Programado es lo mismo con hora: el reloj de `arrancarProgramados` lo envía
 * al llegar, y a quién va se calcula entonces, no al programarlo.
 */
import { EstadoComunicado, EstadoEnvio, EstadoPago, EstadoSolicitud, Prisma, TipoComunicado, TipoRecibo } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearContenidoCms, extractoPlano } from '../utils/sanear-html.js';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { enviarCorreo } from './correos/envio.js';
import { colaTerminada, despertarCola, ponerMaquetaDeComunicados, reintentarLote, retirarBoletinesPendientes, topeDiario, topePorHora } from './correos/cola.js';
import { firma, maquetar, parrafo, saludo, urlDeLaWeb } from './correos/plantilla.js';
import { anioDeLaMesa } from './procesion/zonas.service.js';
import { SalidasService } from './procesion/salidas.service.js';
import { ModulosService } from './modulos.service.js';
import { reemitidosDe } from './recibos/comunes.js';
import { diaDeHoy } from '../domain/fechas-hermano.js';
import { articuloDe, deLaCorporacion } from '../domain/articulos.js';
import {
  adaptarAlCorreo, cabecerasDeBaja, describirSegmento, destinatariosDe, emailDeToken, tokenDeBaja,
  type Destinatario, type Segmento, type SalidaDelSegmento,
} from '../domain/comunicados.js';

export interface DatosComunicado {
  tipo: TipoComunicado;
  asunto: string;
  cuerpo: string;
  segmento: Segmento;
}

const secreto = () => process.env.JWT_SECRET ?? '';

/**
 * Programar a menos de cinco minutos es enviar ya, y a más de un año, un
 * despiste: un comunicado olvidado que saldría cuando ya nadie lo espera.
 */
const ANTELACION_MINIMA_MS = 5 * 60 * 1000;
const ANTELACION_MAXIMA_MS = 366 * 24 * 3600 * 1000;

/** Lo que se dice al intentar tocar lo que ya no es borrador. */
function noEsBorrador(estado: EstadoComunicado): HttpError {
  return estado === EstadoComunicado.PROGRAMADO
    ? new HttpError('Este comunicado está programado: devuélvelo a borrador para cambiarlo.', 409)
    : new HttpError('Este comunicado ya se envió: no se puede cambiar.', 409);
}

/** Solo los filtros que se conocen, para guardar lo que se eligió y nada más. */
function segmentoLimpio(s: Segmento): Segmento {
  return {
    conPapeleta: Number.isInteger(s.conPapeleta) && (s.conPapeleta ?? 0) > 0 ? s.conPapeleta : null,
    apuntadosA: Number.isInteger(s.apuntadosA) && (s.apuntadosA ?? 0) > 0 ? s.apuntadosA : null,
    conDeuda: s.conDeuda === true,
    edad: s.edad === 'MAYORES' || s.edad === 'MENORES' ? s.edad : null,
    poblacion: s.poblacion?.trim().slice(0, 100) || null,
  };
}
/**
 * El segmento que se aplica de verdad: «con papeleta de…» y «apuntados a…» son de Procesión y,
 * apagada, el filtro no existe. Se guarda igual (vuelve al reencender), pero
 * ni se consulta ni se describe: el «a quién va» no debe prometer un filtro
 * que no se aplica.
 */
async function segmentoAplicable(s: Segmento): Promise<Segmento> {
  return (s.conPapeleta || s.apuntadosA) && !(await ModulosService.activo('procesion')) ? { ...s, conPapeleta: null, apuntadosA: null } : s;
}


/**
 * Quién debe cuotas, con el mismo criterio que la lista de impagos: solo
 * CUOTA_HERMANO y sin las devueltas que ya se reemitieron. Con «algún recibo
 * pendiente o devuelto» a secas, el aviso de impago llegaba a quien ya había
 * pagado la reemisión, a quien se le reembolsó una papeleta o a quien tenía
 * un donativo sin cobrar.
 */
async function idsConCuotasPendientes(): Promise<number[]> {
  const recibos = await db.recibo.findMany({
    where: { tipo: TipoRecibo.CUOTA_HERMANO, estado: { in: [EstadoPago.PENDIENTE, EstadoPago.DEVUELTO] }, hermano: { activo: true } },
    select: { id: true, hermanoId: true, year: true, tipo: true, estado: true },
  });
  const reemitidos = await reemitidosDe(recibos.filter((r) => r.estado === EstadoPago.DEVUELTO));
  return [...new Set(recibos.filter((r) => !reemitidos.has(r.id)).map((r) => r.hermanoId))];
}

/** Las fichas del segmento: siempre activas; en el boletín, solo las suscritas. */
async function fichasDelSegmento(tipo: TipoComunicado, s: Segmento) {
  const hoy = diaDeHoy();
  const hace18 = new Date(`${Number(hoy.slice(0, 4)) - 18}${hoy.slice(4)}T00:00:00Z`);
  const { conPapeleta, apuntadosA } = await segmentoAplicable(s);
  const apuntados = apuntadosA ? { salidaId: apuntadosA, year: anioDeLaMesa(await SalidasService.porId(apuntadosA)) } : null;
  const where: Prisma.HermanoWhereInput = {
    activo: true,
    ...(tipo === TipoComunicado.BOLETIN ? { boletin: true } : {}),
    ...(conPapeleta ? { papeletas: { some: { salidaId: conPapeleta, year: anioDeLaMesa(await SalidasService.porId(conPapeleta)) } } } : {}),
    ...(apuntados ? { OR: [{ papeletas: { some: apuntados } }, { solicitudes: { some: { ...apuntados, estado: EstadoSolicitud.PENDIENTE } } }] } : {}),
    ...(s.conDeuda ? { id: { in: await idsConCuotasPendientes() } } : {}),
    ...(s.edad === 'MAYORES' ? { fechaNacimiento: { lte: hace18 } } : s.edad === 'MENORES' ? { fechaNacimiento: { gt: hace18 } } : {}),
    ...(s.poblacion ? { poblacion: s.poblacion } : {}),
  };
  const fichas = await db.hermano.findMany({
    where,
    select: { nombre: true, sexo: true, email: true, user: { select: { id: true, email: true } } },
    orderBy: [{ apellidos: 'asc' }, { id: 'asc' }],
  });
  return fichas.map((f) => ({ nombre: f.nombre, sexo: f.sexo, email: f.email, emailCuenta: f.user.email, userId: f.user.id }));
}

/** El correo de un comunicado para un destinatario. */
function correoPara(c: { tipo: TipoComunicado; asunto: string; cuerpo: string }, d: Destinatario): string {
  const esBoletin = c.tipo === TipoComunicado.BOLETIN;
  const cuerpo = adaptarAlCorreo(c.cuerpo, urlDeLaWeb(), process.env.API_URL || 'http://localhost:3001');
  const baja = esBoletin
    ? parrafo(
      `Recibe este boletín porque se suscribió en su ficha. Si ya no quiere recibirlo, <a href="${urlDeLaWeb(`/boletin/baja?t=${encodeURIComponent(tokenDeBaja(d.email, secreto()))}`)}" style="color: inherit; text-decoration: underline;">dese de baja aquí</a>.`,
      'margin-top: 28px; font-size: 13px; color: #6b6259;',
    )
    : '';
  return maquetar({
    titulo: c.asunto,
    antetitulo: `${esBoletin ? 'Boletín' : 'Aviso'} ${deLaCorporacion()}`,
    resumen: extractoPlano(c.cuerpo).slice(0, 140),
    contenido: [
      d.nombre ? saludo(d.nombre, d.sexo) : parrafo('Queridos hermanos:'),
      cuerpo,
      firma(null, esBoletin ? 'La Junta de Gobierno' : 'La Secretaría'),
      baja,
    ].join(''),
  });
}

/** El nombre y el artículo de cada salida por su id, también de las desactivadas: un comunicado viejo sigue diciendo a quién fue. */
const nombresDeSalidas = async () => new Map((await SalidasService.listar({ todas: true }))
  .map((s) => [s.id, { nombre: s.nombre, articulo: articuloDe(s) }]));

const resumen = async (c: { id: number; tipo: TipoComunicado; asunto: string; estado: EstadoComunicado; segmento: Prisma.JsonValue; programadoPara: Date | null; enviadoEl: Date | null; autorNombre: string | null; createdAt: Date; updatedAt: Date }, nombres: ReadonlyMap<number, SalidaDelSegmento>) => ({
  id: c.id, tipo: c.tipo, asunto: c.asunto, estado: c.estado, segmento: c.segmento as Segmento,
  para: describirSegmento(c.tipo, await segmentoAplicable(c.segmento as Segmento), nombres),
  programadoPara: c.programadoPara, enviadoEl: c.enviadoEl, autorNombre: c.autorNombre,
  createdAt: c.createdAt, updatedAt: c.updatedAt,
});

// --- El envío: lo hace la cola de correos ----------------------------------

/** La baja en un clic, solo en el boletín: a los avisos no se suscribe nadie. */
function cabecerasPara(c: { tipo: TipoComunicado }, email: string) {
  return c.tipo === TipoComunicado.BOLETIN ? cabecerasDeBaja(email, secreto(), process.env.API_URL || 'http://localhost:3001') : undefined;
}
ponerMaquetaDeComunicados({ correo: correoPara, cabeceras: cabecerasPara });

export class ComunicadosService {
  static async listar() {
    // Sin el cuerpo: la lista no lo enseña, y con fotos dentro pesa megas.
    // Los programados, arriba y en el orden en que saldrán: son lo que está por pasar.
    const programados = await db.comunicado.findMany({ where: { estado: EstadoComunicado.PROGRAMADO }, omit: { cuerpo: true }, orderBy: [{ programadoPara: 'asc' }, { id: 'asc' }] });
    const resto = await db.comunicado.findMany({ where: { estado: { not: EstadoComunicado.PROGRAMADO } }, omit: { cuerpo: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200 });
    const lista = [...programados, ...resto];
    const cuentas = await db.comunicadoEnvio.groupBy({ by: ['comunicadoId', 'estado'], where: { comunicadoId: { in: lista.map((c) => c.id) } }, _count: { _all: true } });
    const de = (id: number, estado: EstadoEnvio) => cuentas.find((x) => x.comunicadoId === id && x.estado === estado)?._count._all ?? 0;
    const nombres = await nombresDeSalidas();
    return Promise.all(lista.map(async (c) => ({
      ...(await resumen(c, nombres)),
      envios: { enviados: de(c.id, EstadoEnvio.ENVIADO), fallidos: de(c.id, EstadoEnvio.FALLIDO), rebotados: de(c.id, EstadoEnvio.REBOTADO), pendientes: de(c.id, EstadoEnvio.PENDIENTE) },
    })));
  }

  static async obtener(id: number) {
    const c = await db.comunicado.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Comunicado no encontrado.');
    return { ...(await resumen(c, await nombresDeSalidas())), cuerpo: c.cuerpo };
  }

  /** A cuántas direcciones llegaría, y cuántas fichas del segmento no tienen correo. */
  static async destinatarios(tipo: TipoComunicado, segmento: Segmento) {
    const s = await segmentoAplicable(segmentoLimpio(segmento));
    const fichas = await fichasDelSegmento(tipo, s);
    const { destinatarios, sinCorreo } = destinatariosDe(fichas);
    // El ritmo de la cola va con la cuenta: el CMS calcula con él cuándo lo tendrán todos.
    return { para: describirSegmento(tipo, s, await nombresDeSalidas()), fichas: fichas.length, correos: destinatarios.length, sinCorreo, ritmo: { porHora: topePorHora(), porDia: topeDiario() } };
  }

  static async crear(datos: DatosComunicado, meta?: MetaDeAuditoria) {
    const autor = meta?.userId ? await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true, apellidos: true } }) : null;
    const c = await db.comunicado.create({
      data: {
        tipo: datos.tipo, asunto: datos.asunto.trim(), cuerpo: sanearContenidoCms(datos.cuerpo),
        segmento: segmentoLimpio(datos.segmento) as Prisma.InputJsonObject,
        autorId: meta?.userId ?? null, autorNombre: autor ? `${autor.nombre} ${autor.apellidos}`.trim() : null,
      },
    });
    return { ...(await resumen(c, await nombresDeSalidas())), cuerpo: c.cuerpo };
  }

  /** Solo el borrador se cambia: lo enviado es lo que recibieron. */
  static async actualizar(id: number, datos: DatosComunicado) {
    const cambiado = await db.comunicado.updateMany({
      where: { id, estado: EstadoComunicado.BORRADOR },
      data: {
        tipo: datos.tipo, asunto: datos.asunto.trim(), cuerpo: sanearContenidoCms(datos.cuerpo),
        segmento: segmentoLimpio(datos.segmento) as Prisma.InputJsonObject,
      },
    });
    if (cambiado.count === 0) {
      const c = await db.comunicado.findUnique({ where: { id }, select: { estado: true } });
      if (!c) throw new NotFoundError('Comunicado no encontrado.');
      throw noEsBorrador(c.estado);
    }
    return ComunicadosService.obtener(id);
  }

  static async borrar(id: number) {
    const borrado = await db.comunicado.deleteMany({ where: { id, estado: EstadoComunicado.BORRADOR } });
    if (borrado.count === 0) {
      const c = await db.comunicado.findUnique({ where: { id }, select: { estado: true } });
      throw c?.estado === EstadoComunicado.PROGRAMADO
        ? new HttpError('Este comunicado está programado: devuélvelo a borrador para borrarlo.', 409)
        : new HttpError('Solo se borran los borradores: lo enviado se queda como constancia.', 409);
    }
  }

  /** Una prueba a quien lo está escribiendo, con su nombre en el saludo. */
  static async enviarPrueba(id: number, meta?: MetaDeAuditoria) {
    const c = await db.comunicado.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Comunicado no encontrado.');
    const yo = meta?.userId ? await db.user.findUnique({ where: { id: meta.userId }, select: { email: true, nombre: true } }) : null;
    if (!yo) throw new HttpError('No se sabe a quién mandar la prueba.');
    const ok = await enviarCorreo(yo.email, `[Prueba] ${c.asunto}`, correoPara(c, { email: yo.email, nombre: yo.nombre, sexo: null }), { uso: 'comunicado_prueba', cabeceras: cabecerasPara(c, yo.email) });
    if (!ok) throw new HttpError('La prueba no ha salido: revisa la cuenta de correo del servidor.', 502);
    return { message: `Prueba enviada a ${yo.email}.` };
  }

  /**
   * Apunta a los destinatarios y arranca el envío. Todo o nada: si dos
   * personas pulsan a la vez, o una pulsa «Enviarlo ya» justo cuando le llega
   * su hora a uno programado, solo uno lo manda.
   */
  static async enviar(id: number, meta?: MetaDeAuditoria) {
    const c = await db.comunicado.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Comunicado no encontrado.');
    const enviable: EstadoComunicado[] = [EstadoComunicado.BORRADOR, EstadoComunicado.PROGRAMADO];
    if (!enviable.includes(c.estado)) throw new HttpError('Este comunicado ya se envió.', 409);
    const { destinatarios } = destinatariosDe(await fichasDelSegmento(c.tipo, c.segmento as Segmento));
    if (destinatarios.length === 0) throw new HttpError('Nadie del segmento tiene correo: no hay a quién mandarlo.', 409);
    await db.$transaction(async (tx) => {
      const pasa = await tx.comunicado.updateMany({
        where: { id, estado: { in: enviable } },
        data: { estado: EstadoComunicado.ENVIANDO, enviadoEl: new Date(), programadoPara: null },
      });
      if (pasa.count === 0) throw new HttpError('Este comunicado ya se envió.', 409);
      await tx.comunicadoEnvio.createMany({
        data: destinatarios.map((d) => ({
          comunicadoId: id, email: d.email, nombre: d.nombre, sexo: d.sexo,
          userId: d.userId ?? null,
        })),
      });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.COMUNICADO_ENVIAR, meta ?? {}, 'comunicado', id, {
      despues: { tipo: c.tipo, asunto: c.asunto, destinatarios: destinatarios.length },
    });
    void despertarCola();
    return { message: `Enviando a ${destinatarios.length === 1 ? '1 dirección' : `${destinatarios.length} direcciones`}. Tarda unos minutos: se ve aquí cómo avanza.`, destinatarios: destinatarios.length };
  }

  /**
   * Lo deja programado para un día y una hora, o le cambia la hora si ya lo
   * estaba. Se comprueba ya que llegaría a alguien, para no enterarse el día.
   */
  static async programar(id: number, cuando: Date, meta?: MetaDeAuditoria, ahora: Date = new Date()) {
    const c = await db.comunicado.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Comunicado no encontrado.');
    const programable: EstadoComunicado[] = [EstadoComunicado.BORRADOR, EstadoComunicado.PROGRAMADO];
    if (!programable.includes(c.estado)) throw new HttpError('Este comunicado ya se envió.', 409);
    if (cuando.getTime() < ahora.getTime() + ANTELACION_MINIMA_MS) throw new HttpError('Elige una hora de dentro de cinco minutos como pronto. Para mandarlo ya, «Ahora».');
    if (cuando.getTime() > ahora.getTime() + ANTELACION_MAXIMA_MS) throw new HttpError('Como mucho, se programa a un año vista.');
    const { destinatarios } = destinatariosDe(await fichasDelSegmento(c.tipo, c.segmento as Segmento));
    if (destinatarios.length === 0) throw new HttpError('Nadie del segmento tiene correo: no hay a quién mandarlo.', 409);

    const pasa = await db.comunicado.updateMany({
      where: { id, estado: { in: programable } },
      data: { estado: EstadoComunicado.PROGRAMADO, programadoPara: cuando },
    });
    if (pasa.count === 0) throw new HttpError('Este comunicado ya se envió.', 409);
    await AuditoriaService.log(ACCIONES_AUDITORIA.COMUNICADO_PROGRAMAR, meta ?? {}, 'comunicado', id, {
      ...(c.programadoPara ? { antes: { programadoPara: c.programadoPara.toISOString() } } : {}),
      despues: { tipo: c.tipo, asunto: c.asunto, programadoPara: cuando.toISOString() },
    });
    return ComunicadosService.obtener(id);
  }

  /** Lo saca de la programación: vuelve a ser un borrador que se puede corregir. */
  static async devolverABorrador(id: number, meta?: MetaDeAuditoria) {
    const pasa = await db.comunicado.updateMany({
      where: { id, estado: EstadoComunicado.PROGRAMADO },
      data: { estado: EstadoComunicado.BORRADOR, programadoPara: null },
    });
    if (pasa.count === 0) {
      const c = await db.comunicado.findUnique({ where: { id }, select: { estado: true } });
      if (!c) throw new NotFoundError('Comunicado no encontrado.');
      throw c.estado === EstadoComunicado.BORRADOR
        ? new HttpError('Este comunicado ya es un borrador.', 409)
        : new HttpError('Ya ha empezado a salir: no se puede devolver a borrador.', 409);
    }
    await AuditoriaService.log(ACCIONES_AUDITORIA.COMUNICADO_DESPROGRAMAR, meta ?? {}, 'comunicado', id, {});
    return ComunicadosService.obtener(id);
  }

  /**
   * Los programados a los que les ha llegado la hora, a la cola. Uno que ya no
   * llega a nadie (se dieron de baja todos) vuelve a borrador en vez de
   * reintentarse cada minuto: el CMS lo enseña así y nadie cree que salió.
   */
  static async enviarLosProgramados(ahora: Date = new Date()) {
    const toca = await db.comunicado.findMany({
      where: { estado: EstadoComunicado.PROGRAMADO, programadoPara: { lte: ahora } },
      select: { id: true }, orderBy: [{ programadoPara: 'asc' }, { id: 'asc' }],
    });
    for (const { id } of toca) {
      try {
        await ComunicadosService.enviar(id);
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        // Solo si sigue programado: si alguien pulsó «Enviarlo ya» a la vez, ya está saliendo.
        const vuelve = await db.comunicado.updateMany({ where: { id, estado: EstadoComunicado.PROGRAMADO }, data: { estado: EstadoComunicado.BORRADOR, programadoPara: null } });
        if (vuelve.count > 0) console.warn(`[Comunicados] El programado ${id} no ha salido y vuelve a borrador: ${error.message}`);
      }
    }
    return toca.length;
  }

  /** Vuelve a intentar los que fallaron (la cuenta se quedó sin cupo, por ejemplo). */
  static async reintentarFallidos(id: number) {
    const r = await db.$transaction([
      db.comunicadoEnvio.updateMany({ where: { comunicadoId: id, estado: EstadoEnvio.FALLIDO }, data: { estado: EstadoEnvio.PENDIENTE, enviadoEl: null } }),
      db.comunicado.updateMany({ where: { id, estado: EstadoComunicado.ENVIADO }, data: { estado: EstadoComunicado.ENVIANDO } }),
    ]);
    if (r[0].count === 0) throw new HttpError('No hay envíos fallidos que reintentar.', 409);
    void despertarCola();
    return { message: `Reintentando ${r[0].count === 1 ? '1 envío' : `${r[0].count} envíos`}.` };
  }

  /**
   * Los fallidos de un envío a muchos por la clave con que lo enseña la
   * pantalla de envíos: `comunicado:<id>` o el lote de la cola.
   */
  static async reintentarEnvio(clave: string) {
    const comunicado = /^comunicado:(\d+)$/.exec(clave);
    if (comunicado) return ComunicadosService.reintentarFallidos(Number(comunicado[1]));
    const cuantos = await reintentarLote(clave);
    if (cuantos === 0) throw new HttpError('No hay envíos fallidos que reintentar.', 409);
    return { message: `Reintentando ${cuantos === 1 ? '1 envío' : `${cuantos} envíos`}.` };
  }

  /** La baja del boletín desde el enlace del correo: todas las fichas con esa dirección. */
  static async bajaDelBoletin(token: string) {
    const email = emailDeToken(token, secreto());
    if (!email) throw new HttpError('El enlace de baja no es válido. Cópialo entero del correo, o date de baja desde tu área de hermanos.');
    // Las mismas fichas que da de baja una queja (`RebotesService`),
    // también las que guardan el correo en blanco y usan el de su cuenta.
    const r = await db.hermano.updateMany({
      where: { boletin: true, OR: [{ email }, { email: null, user: { email } }, { email: '', user: { email } }] },
      data: { boletin: false },
    });
    // Con el tope del día, el boletín siguiente puede estar aún en la cola.
    await retirarBoletinesPendientes(email);
    await AuditoriaService.log(ACCIONES_AUDITORIA.BOLETIN_BAJA, {}, 'boletin', undefined, { despues: { fichas: r.count } });
    return { message: `Hecho: ya no recibirás el boletín. Los avisos ${deLaCorporacion({ corto: true })} (cuotas, cabildos) te seguirán llegando.`, fichas: r.count };
  }
}

/**
 * Al arrancar el servidor: cada minuto, los programados a los que les toca. Uno
 * cuya hora pasó con el servidor apagado sale al arrancar, tarde pero entero.
 */
export function arrancarProgramados(): void {
  const vuelta = () => void ComunicadosService.enviarLosProgramados()
    .catch((error) => console.error('❌ [Comunicados] No se han podido enviar los programados:', error));
  vuelta();
  setInterval(vuelta, 60 * 1000).unref();
}

/** Para las pruebas: esperar a que el envío en segundo plano termine. */
export const envioTerminado = () => colaTerminada();
