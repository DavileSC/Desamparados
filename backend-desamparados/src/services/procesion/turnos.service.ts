/**
 * El cuadrante: los días de reparto y quién los cubre. Secretaría los abre,
 * cambia su aforo o los cierra, y los miembros de la Junta se apuntan a
 * trabajarlos.
 */
import { CrearTurnoDto } from './../../dtos/procesion.dto';
import db from '../../config/db';
import { EstadoCita, Prisma, TipoEvento } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service';
import { HttpError, NotFoundError } from '../../utils/error.handle';
import { motivoTurnoInvalido } from '../../domain/datos-procesion.js';
import { diaMadrid, fechaDeSalida, motivoRepartoFueraDeTemporada, sumarDias } from '../../domain/fecha-salida.js';
import { aArticulo, deArticulo, type Articulo } from '../../domain/articulos.js';
import { PlazoPapeletasService } from './plazo.service';
import { reglaDe, type SalidaConActo } from './salidas.service.js';

const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });

/**
 * El acto de la Agenda pública que anuncia un día de reparto: así la gente
 * sabe cuándo ir a apuntarse o a recoger la papeleta, sin entrar al área.
 */
function actoDelReparto(t: { salida: { nombre: string; articulo: string; conRopa: boolean }; horaInicio: Date; horaFin: Date }): Prisma.EventoCreateInput {
  const horas = `de ${formatoHora.format(t.horaInicio)} a ${formatoHora.format(t.horaFin)}`;
  // `as Articulo`: la columna es un VARCHAR(3) sin enum en Prisma; el esquema de alta/edición de la salida es quien de verdad limita los cuatro valores.
  const articulo = t.salida.articulo as Articulo;
  return {
    title: `Reparto de papeletas ${deArticulo(articulo, t.salida.nombre)}`,
    description: t.salida.conRopa
      ? `Día para recoger la papeleta ${deArticulo(articulo, t.salida.nombre)} y la túnica, ${horas}. Hay que estar al día con la cuota de hermano y llevar el DNI.`
      : `Día para apuntarse ${aArticulo(articulo, t.salida.nombre)} y recoger la papeleta, ${horas}. Hay que estar al día con la cuota de hermano.`,
    startDate: t.horaInicio,
    endDate: t.horaFin,
    type: TipoEvento.OTRO,
  };
}

/** Un turno en la auditoría, con las fechas en ISO. */
function fotoTurno(t: { fecha: Date; horaInicio: Date; horaFin: Date; capacidadEstimada: number; activo: boolean; salidaId: number }) {
  return {
    salidaId: t.salidaId,
    fecha: t.fecha.toISOString(),
    horaInicio: t.horaInicio.toISOString(),
    horaFin: t.horaFin.toISOString(),
    capacidadEstimada: t.capacidadEstimada,
    activo: t.activo
  };
}

export class TurnosService {

  /**
   * Los días de reparto de la salida que se prepara, para el panel de
   * Secretaría: los que quedan y los que ya pasaron. Los de otros años no
   * salen (se guardan: sus citas son el histórico de los hermanos). Con la
   * Pascua, son los que caen después de la salida del año anterior y hasta
   * la de este, aunque sean del otoño anterior; a mano, los del año natural.
   *
   * `citas` cuenta todas las que no se anularon: al venir, la cita pasa de
   * reservada a atendida, y contar solo las reservadas dejaba a 0 los días
   * ya repartidos. `vinieron`, las atendidas.
   */
  static async getTodosLosTurnos(salida: SalidaConActo) {
    const year = PlazoPapeletasService.anioDeLaProcesion(salida);
    const regla = reglaDe(salida);
    const anterior = regla.fecha === 'PASCUA' ? fechaDeSalida(regla, year - 1) : null;
    const desde = anterior ? sumarDias(anterior, 1) : `${year}-01-01`;
    const hasta = sumarDias(fechaDeSalida(regla, year) ?? `${year}-12-31`, 1);
    const turnos = await db.turno.findMany({
      where: { salidaId: salida.id, fecha: { gte: new Date(`${desde}T00:00:00Z`), lt: new Date(`${hasta}T00:00:00Z`) } },
      orderBy: { fecha: 'desc' },
    });
    const cuentas = await db.cita.groupBy({
      by: ['turnoId', 'estado'],
      where: { turnoId: { in: turnos.map((t) => t.id) }, estado: { not: EstadoCita.CANCELADA } },
      _count: { _all: true },
    });
    const cuantas = (turnoId: number, estado?: EstadoCita) => cuentas
      .filter((c) => c.turnoId === turnoId && (!estado || c.estado === estado))
      .reduce((s, c) => s + c._count._all, 0);
    return turnos.map((t) => ({ ...t, citas: cuantas(t.id), vinieron: cuantas(t.id, EstadoCita.ATENDIDA) }));
  }

  /**
   * Crear un nuevo día de reparto en la Casa Grupo Parroquial.
   */
  static async crearTurno(data: CrearTurnoDto, salida: SalidaConActo, meta?: MetaDeAuditoria) {
    // 1. Convertimos los textos (strings) a fechas reales de JavaScript
    const fechaInicio = new Date(data.horaInicio);
    const fechaFin = new Date(data.horaFin);

    // 2. Las horas, del mismo día (de Madrid) que el turno y en orden: procesar
    // ausencias decide por horaFin si el turno ya terminó (ver motivoTurnoInvalido).
    const motivo = motivoTurnoInvalido(data.fecha, fechaInicio, fechaFin);
    if (motivo) throw new HttpError(motivo);

    // 3. Antes de la próxima salida: la papeleta cuenta para el año de esa
    // salida, y un reparto después de ella la contaría en una que ya pasó.
    const fueraDeTemporada = motivoRepartoFueraDeTemporada(diaMadrid(new Date(data.fecha)), reglaDe(salida), diaMadrid(new Date()), salida.nombre, salida.articulo as Articulo);
    if (fueraDeTemporada) throw new HttpError(fueraDeTemporada);

    // 4. Lo guardamos, con su acto en la Agenda pública.
    const turno = await db.turno.create({
      data: {
        fecha: new Date(data.fecha),
        horaInicio: fechaInicio,
        horaFin: fechaFin,
        capacidadEstimada: data.capacidadEstimada,
        salida: { connect: { id: salida.id } },
        activo: true, // Por defecto lo abrimos al crearlo
        evento: { create: actoDelReparto({ salida, horaInicio: fechaInicio, horaFin: fechaFin }) },
      }
    });

    await AuditoriaService.log(ACCIONES_AUDITORIA.TURNO_CREAR, meta ?? {}, 'turno', turno.id, { despues: fotoTurno(turno) });
    return turno;
  }

  /**
   * Modificar un turno existente (Ej: Se pone malo el tesorero y hay que bajar el aforo a la mitad).
   */
  static async actualizarTurno(
    turnoId: number,
    data: { capacidadEstimada?: number, activo?: boolean, horaInicio?: Date, horaFin?: Date },
    meta?: MetaDeAuditoria
  ) {
    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundError('Turno no encontrado');

    // Solo actualizamos las horas si nos las envían; se valida el turno tal y
    // como quedaría (la hora nueva con la otra que ya tenía), con las mismas
    // reglas que al crearlo.
    const horaInicio = data.horaInicio ? new Date(data.horaInicio) : undefined;
    const horaFin = data.horaFin ? new Date(data.horaFin) : undefined;
    if (horaInicio || horaFin) {
      const motivo = motivoTurnoInvalido(turno.fecha, horaInicio ?? turno.horaInicio, horaFin ?? turno.horaFin);
      if (motivo) throw new HttpError(motivo);
    }

    const actualizado = await db.turno.update({
      where: { id: turnoId },
      data: {
        capacidadEstimada: data.capacidadEstimada,
        activo: data.activo,
        horaInicio,
        horaFin
      },
      include: { salida: true },
    });
    // El acto de la Agenda sigue al turno: con sus horas mientras está abierto,
    // fuera si se cierra (y de vuelta si se reabre).
    if (actualizado.activo) {
      await db.turno.update({
        where: { id: turnoId },
        data: { evento: turno.eventoId ? { update: actoDelReparto(actualizado) } : { create: actoDelReparto(actualizado) } },
      });
    } else if (turno.eventoId) {
      await db.evento.deleteMany({ where: { id: turno.eventoId } });
    }

    await AuditoriaService.log(ACCIONES_AUDITORIA.TURNO_ACTUALIZAR, meta ?? {}, 'turno', turnoId, {
      antes: fotoTurno(turno),
      despues: fotoTurno(actualizado)
    });
    return actualizado;
  }

  /**
   * Elimina un día de reparto: solo si nos hemos equivocado al crearlo, aún
   * no ha pasado y no hay nadie apuntado. Uno ya pasado es historia del reparto.
   */
  static async eliminarTurno(turnoId: number, meta?: MetaDeAuditoria) {
    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundError('Turno no encontrado');

    if (turno.horaFin.getTime() < Date.now()) {
      throw new HttpError('Ese día de reparto ya ha pasado: se queda como parte del histórico.');
    }
    const ocupacion = await db.cita.count({ where: { turnoId } });
    if (ocupacion > 0) {
      throw new HttpError('No puedes borrar este día porque ya hay hermanos con cita.');
    }

    const borrado = await db.turno.delete({ where: { id: turnoId } });
    if (turno.eventoId) await db.evento.deleteMany({ where: { id: turno.eventoId } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.TURNO_ELIMINAR, meta ?? {}, 'turno', turnoId, { antes: fotoTurno(turno) });
    return borrado;
  }

  /**
   * Un miembro de la Junta dice: "Yo voy a cubrir este turno".
   */
  static async apuntarmeATurno(userId: number, turnoId: number) {
    // 1. EL BLINDAJE: ¿Es de la Junta?
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.esJuntaDeGobierno) {
      throw new HttpError('Solo los miembros de la Junta de Gobierno pueden apuntarse a trabajar en los turnos.');
    }

    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundError('Turno no encontrado');

    return await db.turno.update({
      where: { id: turnoId },
      data: { responsables: { connect: { id: userId } } }
    });
  }

  /**
   * Un miembro de la Junta dice: "Al final me ha surgido algo, me borro de este turno".
   */
  static async desapuntarmeDeTurno(userId: number, turnoId: number) {
    return await db.turno.update({
      where: { id: turnoId },
      data: {
        responsables: {
          disconnect: { id: userId }
        }
      }
    });
  }

  /**
   * (MODIFICACIÓN) Ver el calendario completo con la gente que viene a sacar papeleta
   * Y los miembros de la Junta que van a estar trabajando.
   */
  static async getCuadranteTurnos() {
    return await db.turno.findMany({
      orderBy: { fecha: 'asc' },
      include: {
        // Cuántos hermanos de la calle vienen
        _count: {
          select: { citas: { where: { estado: EstadoCita.RESERVADA } } }
        },
        // Qué miembros de la Junta están apuntados para trabajar
        responsables: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            role: true // Muy útil para saber si hay algún TESORERO apuntado para cobrar
          }
        }
      }
    });
  }
}
