/**
 * Los cabildos de hermanos: convocarlos, llevar la asistencia y el quórum,
 * apuntar las votaciones y redactar y aprobar el acta, que pasa al libro.
 *
 * El recorrido es de ida: convocado → celebrado → acta aprobada. Al darlo por
 * celebrado se guarda el censo con voto de ese día, para que el quórum que
 * dice el acta no cambie con las altas y bajas de después; y con el acta
 * aprobada ya no se toca nada.
 */
import { EstadoCabildo, Prisma, TipoCabildo, TipoComunicado, type Mayoria } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearContenidoCms } from '../utils/sanear-html.js';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { ComunicadosService } from './comunicados.service.js';
import { diaMadrid, inicioDiaMadrid } from '../domain/contabilidad.js';
import { diaDe } from '../domain/fechas-hermano.js';
import {
  REGLAS_POR_DEFECTO, limitesDelVoto, problemaRecuento, quorum, resultado, tieneVoto, type ReglasCabildo,
} from '../domain/cabildos.js';
import { actasEnPdf } from './informes/actas.js';

const CLAVE_REGLAS = 'cabildo_reglas';

export interface DatosCabildo {
  tipo: TipoCabildo;
  /** Día y hora, en ISO. */
  fecha: string;
  lugar: string;
  ordenDelDia: string[];
}

export interface DatosVotacion {
  asunto: string;
  mayoria: Mayoria;
  aFavor: number;
  enContra: number;
  abstenciones: number;
}

/** Las reglas de voto y quórum guardadas, o las habituales si no hay. */
async function reglasDelCabildo(): Promise<ReglasCabildo> {
  const fila = await db.configuracion.findUnique({ where: { key: CLAVE_REGLAS } });
  if (!fila) return REGLAS_POR_DEFECTO;
  try {
    const r = JSON.parse(fila.value) as Partial<ReglasCabildo>;
    return { ...REGLAS_POR_DEFECTO, ...Object.fromEntries(Object.entries(r).filter(([, v]) => Number.isFinite(v))) };
  } catch {
    return REGLAS_POR_DEFECTO;
  }
}

const diaSiguiente = (dia: string) => new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Cuántos hermanos tienen voto el día del cabildo, contados en la base. */
async function censoConVoto(diaCabildo: string, reglas: ReglasCabildo): Promise<number> {
  const { nacidoHasta, altaHasta } = limitesDelVoto(diaCabildo, reglas);
  return db.hermano.count({
    where: {
      activo: true,
      // El nacimiento se guarda a medianoche UTC; el alta, al empezar el día en Madrid.
      fechaNacimiento: { lte: new Date(`${nacidoHasta}T00:00:00Z`) },
      fechaAlta: { lt: inicioDiaMadrid(diaSiguiente(altaHasta)) },
    },
  });
}

async function cabildoOError(id: number) {
  const c = await db.cabildo.findUnique({ where: { id } });
  if (!c) throw new NotFoundError('Cabildo no encontrado.');
  return c;
}

function exigirAbierto(c: { estado: EstadoCabildo }) {
  if (c.estado === EstadoCabildo.ACTA_APROBADA) throw new HttpError('El acta de este cabildo ya está aprobada: no se puede cambiar.', 409);
}

const ordenDelDia = (valor: Prisma.JsonValue): string[] => (Array.isArray(valor) ? valor.map(String) : []);
const TIPO_TEXTO: Record<TipoCabildo, string> = { ORDINARIO: 'ordinario', EXTRAORDINARIO: 'extraordinario' };

/** «jueves, 15 de octubre de 2026, a las 20:30», en la hora de Madrid. */
function fechaLarga(fecha: Date): string {
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fecha);
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(fecha);
  return `${dia}, a las ${hora}`;
}

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class CabildosService {
  static async listar() {
    const lista = await db.cabildo.findMany({
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: 200,
      include: { _count: { select: { asistencias: true, votaciones: true } } },
    });
    return lista.map((c) => ({
      id: c.id, tipo: c.tipo, fecha: c.fecha, lugar: c.lugar, estado: c.estado,
      puntos: ordenDelDia(c.ordenDelDia).length, asistentes: c._count.asistencias, votaciones: c._count.votaciones,
    }));
  }

  /** El cabildo entero: datos, asistencia con quién tiene voto, quórum y votaciones. */
  static async obtener(id: number) {
    const c = await db.cabildo.findUnique({
      where: { id },
      include: {
        asistencias: {
          include: { hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true, activo: true, fechaNacimiento: true, fechaAlta: true } } },
          orderBy: { registradaEl: 'asc' },
        },
        votaciones: { orderBy: { id: 'asc' } },
      },
    });
    if (!c) throw new NotFoundError('Cabildo no encontrado.');
    const reglas = await reglasDelCabildo();
    const dia = diaMadrid(c.fecha);
    const asistentes = c.asistencias.map((a) => ({
      hermanoId: a.hermano.id, nombre: a.hermano.nombre, apellidos: a.hermano.apellidos, numeroHermano: a.hermano.numeroHermano,
      conVoto: tieneVoto({ activo: a.hermano.activo, fechaNacimiento: a.hermano.fechaNacimiento.toISOString().slice(0, 10), fechaAlta: diaDe(a.hermano.fechaAlta) }, dia, reglas),
    })).sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'));
    const censo = c.censoConVoto ?? await censoConVoto(dia, reglas);
    const presentesConVoto = asistentes.filter((a) => a.conVoto).length;
    return {
      id: c.id, tipo: c.tipo, fecha: c.fecha, lugar: c.lugar, ordenDelDia: ordenDelDia(c.ordenDelDia), estado: c.estado,
      enSegunda: c.enSegunda, acta: c.acta, actaAprobadaEl: c.actaAprobadaEl, convocatoriaId: c.convocatoriaId,
      reglas,
      quorum: { censoConVoto: censo, presentesConVoto, ...quorum(presentesConVoto, censo, reglas) },
      asistentes,
      votaciones: c.votaciones.map((v) => ({ ...v, resultado: resultado(v) })),
    };
  }

  static async crear(datos: DatosCabildo) {
    const c = await db.cabildo.create({
      data: { tipo: datos.tipo, fecha: new Date(datos.fecha), lugar: datos.lugar.trim(), ordenDelDia: datos.ordenDelDia.map((p) => p.trim()).filter(Boolean) },
    });
    return CabildosService.obtener(c.id);
  }

  static async actualizar(id: number, datos: DatosCabildo) {
    const c = await cabildoOError(id);
    exigirAbierto(c);
    // Celebrado, el censo con voto ya está guardado, y es el de ese día.
    if (c.estado === EstadoCabildo.CELEBRADO && diaMadrid(new Date(datos.fecha)) !== diaMadrid(c.fecha)) {
      throw new HttpError('El cabildo ya se celebró: se puede corregir la hora o el lugar, pero no el día, que fija quién tenía voto.', 409);
    }
    await db.cabildo.update({
      where: { id },
      data: { tipo: datos.tipo, fecha: new Date(datos.fecha), lugar: datos.lugar.trim(), ordenDelDia: datos.ordenDelDia.map((p) => p.trim()).filter(Boolean) },
    });
    return CabildosService.obtener(id);
  }

  /** Solo el que aún no se ha celebrado ni tiene a nadie apuntado. */
  static async borrar(id: number) {
    const c = await cabildoOError(id);
    const asistentes = await db.cabildoAsistencia.count({ where: { cabildoId: id } });
    if (c.estado !== EstadoCabildo.CONVOCADO || asistentes > 0) throw new HttpError('Solo se borra un cabildo convocado y sin asistencia apuntada.', 409);
    await db.cabildo.delete({ where: { id } });
  }

  /**
   * La convocatoria, como borrador de aviso en Boletín y avisos: a los mayores
   * de edad, con la fecha, el lugar y el orden del día. Se revisa y se envía
   * desde allí. Si ya se preparó, devuelve la misma.
   */
  static async prepararConvocatoria(id: number, meta?: MetaDeAuditoria) {
    const c = await cabildoOError(id);
    if (c.convocatoriaId) return { comunicadoId: c.convocatoriaId };
    const puntos = ordenDelDia(c.ordenDelDia);
    const cuerpo = [
      `<p>Por la presente se le convoca al cabildo ${TIPO_TEXTO[c.tipo]} de hermanos, que se celebrará el ${escapar(fechaLarga(c.fecha))}, en ${escapar(c.lugar)}, con el siguiente orden del día:</p>`,
      puntos.length ? `<ol>${puntos.map((p) => `<li>${escapar(p)}</li>`).join('')}</ol>` : '',
      '<p>Tienen voto los hermanos mayores de edad con la antigüedad que marcan nuestras reglas. Rogamos la asistencia de todos.</p>',
    ].join('');
    const comunicado = await ComunicadosService.crear({
      tipo: TipoComunicado.AVISO,
      asunto: `Convocatoria de cabildo ${TIPO_TEXTO[c.tipo]}`,
      cuerpo,
      segmento: { edad: 'MAYORES' },
    }, meta);
    await db.cabildo.update({ where: { id }, data: { convocatoriaId: comunicado.id } });
    return { comunicadoId: comunicado.id };
  }

  static async anadirAsistente(id: number, hermanoId: number) {
    exigirAbierto(await cabildoOError(id));
    const h = await db.hermano.findUnique({ where: { id: hermanoId }, select: { activo: true } });
    if (!h) throw new NotFoundError('Hermano no encontrado.');
    if (!h.activo) throw new HttpError('Ese hermano está de baja: no puede asistir al cabildo.');
    await db.cabildoAsistencia.upsert({ where: { cabildoId_hermanoId: { cabildoId: id, hermanoId } }, update: {}, create: { cabildoId: id, hermanoId } });
    return CabildosService.obtener(id);
  }

  static async quitarAsistente(id: number, hermanoId: number) {
    exigirAbierto(await cabildoOError(id));
    // Las votaciones se comprueban al apuntarlas contra los presentes de ese
    // momento: quitar después a uno con voto podía dejar más votos que votantes.
    const estado = await CabildosService.obtener(id);
    const quitado = estado.asistentes.find((a) => a.hermanoId === hermanoId);
    if (quitado?.conVoto) {
      const quedan = estado.quorum.presentesConVoto - 1;
      const pasada = estado.votaciones.find((v) => problemaRecuento(v, quedan) !== null);
      if (pasada) {
        throw new HttpError(`La votación «${pasada.asunto}» tiene ${pasada.aFavor + pasada.enContra + pasada.abstenciones} votos y sin este hermano quedarían ${quedan} presentes con voto: corrige o borra antes la votación.`, 409);
      }
    }
    await db.cabildoAsistencia.deleteMany({ where: { cabildoId: id, hermanoId } });
    return CabildosService.obtener(id);
  }

  static async anadirVotacion(id: number, v: DatosVotacion) {
    exigirAbierto(await cabildoOError(id));
    // Votan los presentes con voto: los menores y los recién llegados asisten, pero no votan.
    const problema = problemaRecuento(v, (await CabildosService.obtener(id)).quorum.presentesConVoto);
    if (problema) throw new HttpError(problema);
    await db.cabildoVotacion.create({ data: { cabildoId: id, asunto: v.asunto.trim(), mayoria: v.mayoria, aFavor: v.aFavor, enContra: v.enContra, abstenciones: v.abstenciones } });
    return CabildosService.obtener(id);
  }

  static async borrarVotacion(id: number, votacionId: number) {
    exigirAbierto(await cabildoOError(id));
    await db.cabildoVotacion.deleteMany({ where: { id: votacionId, cabildoId: id } });
    return CabildosService.obtener(id);
  }

  /**
   * Se celebró: guarda el censo con voto de ese día. Sin quórum en primera,
   * hay que decir que fue en segunda convocatoria, donde bastan los presentes.
   */
  static async darPorCelebrado(id: number, enSegunda: boolean, meta?: MetaDeAuditoria) {
    const c = await cabildoOError(id);
    if (c.estado !== EstadoCabildo.CONVOCADO) throw new HttpError('Este cabildo ya consta como celebrado.', 409);
    const estado = await CabildosService.obtener(id);
    if (estado.asistentes.length === 0) throw new HttpError('Apunta antes la asistencia: un cabildo sin nadie no se celebra.');
    if (!estado.quorum.enPrimera && !enSegunda) {
      throw new HttpError(`No hay quórum en primera convocatoria (hacen falta ${estado.quorum.necesarios} hermanos con voto y hay ${estado.quorum.presentesConVoto}). Márcalo como celebrado en segunda.`, 409);
    }
    await db.cabildo.update({ where: { id }, data: { estado: EstadoCabildo.CELEBRADO, censoConVoto: estado.quorum.censoConVoto, enSegunda: !estado.quorum.enPrimera || enSegunda } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CABILDO_CELEBRAR, meta ?? {}, 'cabildo', id, {
      despues: { censoConVoto: estado.quorum.censoConVoto, presentesConVoto: estado.quorum.presentesConVoto, enSegunda: !estado.quorum.enPrimera || enSegunda },
    });
    return CabildosService.obtener(id);
  }

  static async guardarActa(id: number, html: string) {
    const c = await cabildoOError(id);
    exigirAbierto(c);
    if (c.estado === EstadoCabildo.CONVOCADO) throw new HttpError('El acta se redacta cuando el cabildo ya se ha celebrado.', 409);
    // El estado va en la condición: si se aprobó entre la lectura y aquí, no
    // se reescribe un acta que ya está en el libro.
    const { count } = await db.cabildo.updateMany({ where: { id, estado: EstadoCabildo.CELEBRADO }, data: { acta: sanearContenidoCms(html) } });
    if (count === 0) throw new HttpError('El acta ya está aprobada: no se puede cambiar.', 409);
    return CabildosService.obtener(id);
  }

  /** El acta aprobada pasa al libro y el cabildo ya no se toca. */
  static async aprobarActa(id: number, meta?: MetaDeAuditoria) {
    const c = await cabildoOError(id);
    if (c.estado !== EstadoCabildo.CELEBRADO) throw new HttpError(c.estado === EstadoCabildo.ACTA_APROBADA ? 'El acta ya estaba aprobada.' : 'El cabildo aún no se ha celebrado.', 409);
    if (!c.acta.replace(/<[^>]*>/g, '').trim()) throw new HttpError('El acta está vacía: redáctala antes de aprobarla.');
    const { count } = await db.cabildo.updateMany({ where: { id, estado: EstadoCabildo.CELEBRADO }, data: { estado: EstadoCabildo.ACTA_APROBADA, actaAprobadaEl: new Date() } });
    if (count === 0) throw new HttpError('El acta ya estaba aprobada.', 409);
    await AuditoriaService.log(ACCIONES_AUDITORIA.CABILDO_ACTA_APROBAR, meta ?? {}, 'cabildo', id, { despues: { estado: EstadoCabildo.ACTA_APROBADA } });
    return CabildosService.obtener(id);
  }

  /** El acta de un cabildo en PDF (borrador si aún no está aprobada). */
  static async actaPdf(id: number) {
    const c = await CabildosService.obtener(id);
    if (c.estado === EstadoCabildo.CONVOCADO) throw new HttpError('El cabildo aún no se ha celebrado: todavía no hay acta.', 409);
    return actasEnPdf([c], `Acta del cabildo ${TIPO_TEXTO[c.tipo]}`);
  }

  /** El libro de actas de un año: las actas aprobadas, por fecha. */
  static async libroDeActas(anio: number) {
    const ids = await db.cabildo.findMany({
      where: { estado: EstadoCabildo.ACTA_APROBADA, fecha: { gte: inicioDiaMadrid(`${anio}-01-01`), lt: inicioDiaMadrid(`${anio + 1}-01-01`) } },
      select: { id: true },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    });
    if (ids.length === 0) throw new HttpError(`No hay actas aprobadas de ${anio}.`, 404);
    const cabildos = [];
    for (const { id } of ids) cabildos.push(await CabildosService.obtener(id));
    return actasEnPdf(cabildos, `Libro de actas ${anio}`);
  }
}

export type CabildoCompleto = Awaited<ReturnType<typeof CabildosService.obtener>>;
