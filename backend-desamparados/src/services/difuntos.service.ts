/**
 * Los hermanos difuntos: el registro histórico, sus aniversarios, los
 * sufragios que se ofrecen por ellos y el trato con su familia.
 *
 * Difunto es quien se dio de baja por fallecimiento. A su familia se le
 * escribe solo a propósito (Secretaría pulsa, y elige a quién): la cuenta del
 * propio difunto no se usa nunca. La dirección que se propone es la de otra
 * ficha de la familia con correo o, si el difunto no era el titular, la del
 * titular de la cuenta (su padre, su madre, quien lo apuntó).
 */
import { MotivoBaja, TipoEvento, TipoSufragio } from '@prisma/client';
import db from '../config/db.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { condicionBusqueda } from '../domain/busqueda-texto.js';
import { aniosDeHermano, proximoAniversario } from '../domain/difuntos.js';
import { comprobarBajaNoFutura, instanteDeDia } from '../domain/fechas-hermano.js';
import { EmailService } from './email.service.js';
import { siModulo } from './modulos.service.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';

export const NOMBRE_SUFRAGIO: Record<TipoSufragio, string> = {
  MISA_FUNERAL: 'Misa funeral',
  MISA_ANIVERSARIO: 'Misa de aniversario',
  MISA_SUFRAGIO: 'Misa de sufragio',
  ORACION: 'Oración',
};

const DIFUNTO = { motivoBaja: MotivoBaja.FALLECIMIENTO } as const;
const zona = { timeZone: 'Europe/Madrid' } as const;
const cuandoLargo = new Intl.DateTimeFormat('es-ES', { ...zona, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export interface NuevoSufragio {
  tipo: TipoSufragio;
  /** Día y hora, AAAA-MM-DDTHH:mm en Madrid. */
  fecha: string;
  lugar?: string | null;
  notas?: string | null;
  /** Publicarlo en la Agenda de la web. */
  enAgenda?: boolean;
  /** Avisar a la familia a esta dirección. */
  avisarA?: string | null;
}

/** «2026-11-03T19:30» en Madrid → el instante. */
function instanteMadrid(fechaHora: string): Date {
  const [dia, hora = '00:00'] = fechaHora.split('T');
  const inicio = instanteDeDia(dia, 'fechaDefuncion');
  const [h, m] = hora.split(':').map(Number);
  return new Date(inicio.getTime() + (h * 60 + m) * 60_000);
}

const nombreDe = (h: { nombre: string; apellidos: string }) => `${h.nombre} ${h.apellidos}`.trim();

export class DifuntosService {
  /** El registro de difuntos, del fallecimiento más reciente al más antiguo, con su próximo aniversario. */
  static async listar(q: string | undefined, hoy = new Date()) {
    const filas = await db.hermano.findMany({
      where: { ...DIFUNTO, ...condicionBusqueda(q?.trim(), ['nombre', 'apellidos']) },
      orderBy: [{ fechaDefuncion: 'desc' }, { fechaBaja: 'desc' }, { id: 'desc' }],
      take: 500,
      select: {
        id: true, nombre: true, apellidos: true, sexo: true, fechaAlta: true, fechaBaja: true, fechaDefuncion: true,
        _count: { select: { sufragios: true } },
      },
    });
    return filas.map((h) => {
      const defuncion = h.fechaDefuncion ?? h.fechaBaja!;
      return {
        id: h.id, nombre: h.nombre, apellidos: h.apellidos, sexo: h.sexo,
        fechaDefuncion: defuncion,
        aniosDeHermano: aniosDeHermano(h.fechaAlta, defuncion),
        aniversario: proximoAniversario(defuncion, hoy),
        sufragios: h._count.sufragios,
      };
    });
  }

  /** Los aniversarios de los próximos `dias` días, del más cercano al más lejano. */
  static async aniversarios(dias = 60, hoy = new Date()) {
    return (await this.listar(undefined, hoy))
      .filter((d) => d.aniversario.faltan <= dias)
      .sort((a, b) => a.aniversario.faltan - b.aniversario.faltan);
  }

  /** A quién escribir en nombre de la familia, si hay a quién. */
  private static async familia(difunto: { id: number; userId: number; esTitular: boolean }) {
    const otras = await db.hermano.findMany({
      where: { userId: difunto.userId, id: { not: difunto.id }, fechaBaja: null, email: { not: null } },
      orderBy: [{ esTitular: 'desc' }, { fechaNacimiento: 'asc' }],
      select: { nombre: true, apellidos: true, email: true },
    });
    const conCorreo = otras.find((h) => h.email?.trim());
    if (conCorreo) return { nombre: nombreDe(conCorreo), email: conCorreo.email!.trim() };
    if (difunto.esTitular) return null;
    // Un menor o alguien a cargo: la cuenta es de quien lo apuntó.
    const [titular, cuenta] = await Promise.all([
      db.hermano.findFirst({ where: { userId: difunto.userId, esTitular: true }, select: { nombre: true, apellidos: true, fechaBaja: true, motivoBaja: true } }),
      db.user.findUnique({ where: { id: difunto.userId }, select: { email: true } }),
    ]);
    if (!cuenta?.email || titular?.motivoBaja === MotivoBaja.FALLECIMIENTO) return null;
    return { nombre: titular ? nombreDe(titular) : null, email: cuenta.email };
  }

  private static async difunto(id: number) {
    const h = await db.hermano.findFirst({
      where: { id, ...DIFUNTO },
      select: { id: true, nombre: true, apellidos: true, sexo: true, userId: true, esTitular: true, fechaAlta: true, fechaBaja: true, fechaDefuncion: true },
    });
    if (!h) throw new NotFoundError('No se encontró a ese hermano entre los difuntos.');
    return h;
  }

  /** La ficha de un difunto: sus datos, sus sufragios y a quién escribir de su familia. */
  static async ficha(id: number, hoy = new Date()) {
    const h = await this.difunto(id);
    const defuncion = h.fechaDefuncion ?? h.fechaBaja!;
    const [sufragios, familia] = await Promise.all([
      db.sufragio.findMany({ where: { hermanoId: id }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }] }),
      this.familia(h),
    ]);
    return {
      id: h.id, nombre: h.nombre, apellidos: h.apellidos, sexo: h.sexo,
      fechaAlta: h.fechaAlta, fechaDefuncion: defuncion,
      aniosDeHermano: aniosDeHermano(h.fechaAlta, defuncion),
      aniversario: proximoAniversario(defuncion, hoy),
      familia,
      sufragios: sufragios.map((s) => ({ ...s, nombreTipo: NOMBRE_SUFRAGIO[s.tipo] })),
    };
  }

  /** Corrige el día del fallecimiento. */
  static async fijarDefuncion(id: number, dia: string, meta: MetaDeAuditoria) {
    const h = await this.difunto(id);
    const fecha = instanteDeDia(dia, 'fechaDefuncion');
    comprobarBajaNoFutura(fecha);
    if (fecha < h.fechaAlta) throw new HttpError('El fallecimiento no puede ser anterior al alta.');
    await db.hermano.update({ where: { id }, data: { fechaDefuncion: fecha } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.DEFUNCION_FIJAR, meta, 'hermano', id, { antes: h.fechaDefuncion, despues: fecha });
  }

  /**
   * Un sufragio nuevo. Con `enAgenda`, sale en la Agenda de la web como culto;
   * con `avisarA`, le llega a la familia el aviso con el día y el lugar.
   */
  static async crearSufragio(id: number, dto: NuevoSufragio, meta: MetaDeAuditoria) {
    const h = await this.difunto(id);
    const fecha = instanteMadrid(dto.fecha);
    const nombre = nombreDe(h);
    const lugar = dto.lugar?.trim() || null;
    // Con la Agenda apagada el sufragio se registra igual, pero sin acto en la web.
    const evento = dto.enAgenda
      ? (await siModulo('agenda', () => db.evento.create({ data: { title: `${NOMBRE_SUFRAGIO[dto.tipo]} por ${nombre}`, startDate: fecha, location: lugar, type: TipoEvento.CULTO } }))) ?? null
      : null;
    const sufragio = await db.sufragio.create({
      data: { hermanoId: id, tipo: dto.tipo, fecha, lugar, notas: dto.notas?.trim() || null, eventoId: evento?.id ?? null },
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.SUFRAGIO_CREAR, meta, 'hermano', id, { sufragio: sufragio.id, tipo: dto.tipo, enAgenda: Boolean(evento) });

    let avisada = false;
    if (dto.avisarA?.trim()) {
      avisada = await EmailService.enviarAvisoSufragio(dto.avisarA.trim(), nombre, {
        que: NOMBRE_SUFRAGIO[dto.tipo], cuando: cuandoLargo.format(fecha), donde: lugar,
      });
      if (avisada) await db.sufragio.update({ where: { id: sufragio.id }, data: { familiaAvisada: new Date() } });
    }
    return { id: sufragio.id, eventoId: evento?.id ?? null, familiaAvisada: avisada };
  }

  /** Quita un sufragio y, si se publicó, su acto de la Agenda. */
  static async borrarSufragio(sufragioId: number, meta: MetaDeAuditoria) {
    const s = await db.sufragio.findUnique({ where: { id: sufragioId } });
    if (!s) throw new NotFoundError('Ese sufragio ya no existe.');
    await db.$transaction(async (tx) => {
      await tx.sufragio.delete({ where: { id: sufragioId } });
      if (s.eventoId) await tx.evento.deleteMany({ where: { id: s.eventoId } });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.SUFRAGIO_BORRAR, meta, 'hermano', s.hermanoId, { sufragio: sufragioId, tipo: s.tipo });
  }

  /** El pésame a la familia, a la dirección que diga Secretaría. */
  static async enviarPesame(id: number, email: string, meta: MetaDeAuditoria) {
    const h = await this.difunto(id);
    const enviado = await EmailService.enviarPesame(email.trim(), nombreDe(h), h.sexo ?? undefined);
    if (!enviado) throw new HttpError('No se ha podido enviar el correo. Inténtalo más tarde.', 502);
    await AuditoriaService.log(ACCIONES_AUDITORIA.PESAME_ENVIAR, meta, 'hermano', id);
  }
}
