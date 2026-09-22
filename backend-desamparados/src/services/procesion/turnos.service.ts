/**
 * El cuadrante: los días de reparto y quién los cubre. Secretaría los abre,
 * cambia su aforo o los cierra, y los miembros de la Junta se apuntan a
 * trabajarlos.
 */
import { CrearTurnoDto } from './../../dtos/procesion.dto';
import db from '../../config/db';
import { EstadoCita } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service';
import { HttpError, NotFoundError } from '../../utils/error.handle';
import { motivoTurnoInvalido } from '../../domain/datos-procesion.js';

/** Un turno en la auditoría, con las fechas en ISO. */
function fotoTurno(t: { fecha: Date; horaInicio: Date; horaFin: Date; capacidadEstimada: number; activo: boolean }) {
  return {
    fecha: t.fecha.toISOString(),
    horaInicio: t.horaInicio.toISOString(),
    horaFin: t.horaFin.toISOString(),
    capacidadEstimada: t.capacidadEstimada,
    activo: t.activo
  };
}

export class TurnosService {

  /**
   * Listar absolutamente todos los turnos para el panel de control de Secretaría.
   * Incluye los pasados, los inactivos y la ocupación real.
   */
  static async getTodosLosTurnos() {
    return await db.turno.findMany({
      orderBy: { fecha: 'desc' },
      include: {
        _count: {
          select: { citas: { where: { estado: EstadoCita.RESERVADA } } }
        }
      }
    });
  }

  /**
   * Crear un nuevo día de reparto en la Casa Grupo Parroquial.
   */
  static async crearTurno(data: CrearTurnoDto, meta?: MetaDeAuditoria) {
    // 1. Convertimos los textos (strings) a fechas reales de JavaScript
    const fechaInicio = new Date(data.horaInicio);
    const fechaFin = new Date(data.horaFin);

    // 2. Las horas, del mismo día (de Madrid) que el turno y en orden: procesar
    // ausencias decide por horaFin si el turno ya terminó (ver motivoTurnoInvalido).
    const motivo = motivoTurnoInvalido(data.fecha, fechaInicio, fechaFin);
    if (motivo) throw new HttpError(motivo);

    // 3. Lo guardamos en la base de datos
    const turno = await db.turno.create({
      data: {
        fecha: new Date(data.fecha),
        horaInicio: fechaInicio,
        horaFin: fechaFin,
        capacidadEstimada: data.capacidadEstimada,
        activo: true // Por defecto lo abrimos al crearlo
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
      }
    });

    await AuditoriaService.log(ACCIONES_AUDITORIA.TURNO_ACTUALIZAR, meta ?? {}, 'turno', turnoId, {
      antes: fotoTurno(turno),
      despues: fotoTurno(actualizado)
    });
    return actualizado;
  }

  /**
   * Elimina un día de reparto (Solo si nos hemos equivocado al crearlo y no hay nadie apuntado).
   */
  static async eliminarTurno(turnoId: number, meta?: MetaDeAuditoria) {
    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundError('Turno no encontrado');

    const ocupacion = await db.cita.count({ where: { turnoId } });
    if (ocupacion > 0) {
      throw new HttpError('No puedes borrar este día porque ya hay hermanos con cita. Desactívalo en su lugar.');
    }

    const borrado = await db.turno.delete({ where: { id: turnoId } });
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
