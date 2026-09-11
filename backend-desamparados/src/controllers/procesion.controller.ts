import { Request, Response } from 'express';
import { ProcesionService } from '../services/procesion.service.js';
import { handleHttp, HttpError } from '../utils/error.handle.js';
import { instanteLimiteAusencias } from '../domain/datos-procesion.js';
import { AuditService } from '../services/audit.service.js';

export class ProcesionController {

  // ============================================================
  //  ZONA HERMANO (APP)
  // ============================================================

  static async getDias(req: Request, res: Response) {
    try {
      const dias = await ProcesionService.getDiasDisponibles();
      res.json(dias);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo días');
    }
  }

  static async avisarAsistencia(req: Request, res: Response) {
    try {
      const userId = req.user!.id; 
      const data = await ProcesionService.avisarAsistencia(userId, req.body);
      res.status(201).json(data);
    } catch (e) {
      handleHttp(res, e, 'Error al avisar asistencia');
    }
  }

  static async cancelarAsistencia(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const citaId = Number(req.params.id);
      await ProcesionService.cancelarAsistencia(userId, citaId);
      res.status(200).json({ message: 'Cita cancelada correctamente.' });
    } catch (e) {
      handleHttp(res, e, 'Error al cancelar la cita');
    }
  }

  static async getMisPapeletas(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const papeletas = await ProcesionService.getMisPapeletas(userId, req.query);
      res.status(200).json(papeletas);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo el historial de papeletas');
    }
  }

  // ============================================================
  //  ZONA ADMIN (La mesa de reparto)
  // ============================================================

  static async getListadoHoy(req: Request, res: Response) {
    try {
      const lista = await ProcesionService.getAsistentesDelDia(new Date());
      res.json(lista);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo listado de hoy');
    }
  }

  static async inscribirManual(req: Request, res: Response) {
    try {
      const result = await ProcesionService.inscribirYFacturar(req.body, AuditService.metaFromReq(req));
      res.status(200).json({
        msg: 'Inscripción realizada. Recibo generado y correo enviado.',
        data: result
      });
    } catch (e) {
      handleHttp(res, e, 'Error al realizar inscripción');
    }
  }

  static async anularPapeleta(req: Request, res: Response) {
    try {
      const papeletaId = Number(req.params.id);
      const result = await ProcesionService.anularPapeleta(papeletaId, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error al anular la papeleta');
    }
  }

  // ============================================================
  //  ZONA ADMIN (Listados Finales y Mantenimiento)
  // ============================================================

  static async getListadoProcesion(req: Request, res: Response) {
    try {
      const year = Number(req.params.year);
      const listado = await ProcesionService.getListadoProcesion(year);
      res.status(200).json(listado);
    } catch (e) {
      handleHttp(res, e, 'Error generando el censo de la procesión');
    }
  }

  static async procesarAusencias(req: Request, res: Response) {
    try {
      // Por defecto, ahora mismo; puede venir en el body (ya validada: legible
      // y no futura). Un día AAAA-MM-DD es el principio de ese día en Madrid,
      // no la medianoche UTC que daría `new Date`. Sin cuerpo, Express 5 deja
      // req.body en undefined.
      const cuerpo = (req.body ?? {}) as { fechaLimite?: string; cierreDefinitivo?: boolean };
      const limite = instanteLimiteAusencias(cuerpo.fechaLimite);
      if (!limite) throw new HttpError('La fecha límite debe ser una fecha válida que no sea posterior a hoy.');
      const cierreDefinitivo = cuerpo.cierreDefinitivo === true;

      const result = await ProcesionService.procesarAusencias(limite, cierreDefinitivo, AuditService.metaFromReq(req));
      res.status(200).json(result);
    } catch (e) {
      handleHttp(res, e, 'Error procesando ausencias');
    }
  }

  // ============================================================
  //  ZONA ADMIN (Gestión de Turnos y Voluntariado)
  // ============================================================

  static async getTodosTurnos(req: Request, res: Response) {
    try {
      const turnos = await ProcesionService.getTodosLosTurnos();
      res.status(200).json(turnos);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo los turnos');
    }
  }

  static async crearTurno(req: Request, res: Response) {
    try {
      const nuevoTurno = await ProcesionService.crearTurno(req.body, AuditService.metaFromReq(req));
      res.status(201).json(nuevoTurno);
    } catch (e) {
      handleHttp(res, e, 'Error creando el turno');
    }
  }

  static async deleteTurno(req: Request, res: Response) {
    try {
      const turnoId = Number(req.params.id);
      await ProcesionService.eliminarTurno(turnoId, AuditService.metaFromReq(req));
      res.status(200).json({ message: 'Turno eliminado correctamente' });
    } catch (e) {
      handleHttp(res, e, 'Error eliminando turno');
    }
  }

  static async getCuadrante(req: Request, res: Response) {
    try {
      const cuadrante = await ProcesionService.getCuadranteTurnos();
      res.status(200).json(cuadrante);
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo cuadrante de la Junta');
    }
  }

  static async apuntarmeTurno(req: Request, res: Response) {
    try {
      const userId = req.user!.id; 
      const turnoId = Number(req.params.id);
      await ProcesionService.apuntarmeATurno(userId, turnoId);
      res.status(200).json({ message: 'Te has apuntado al turno correctamente.' });
    } catch (e) {
      handleHttp(res, e, 'Error al apuntarse al turno');
    }
  }

  static async desapuntarmeTurno(req: Request, res: Response) {
    try {
      const userId = req.user!.id; 
      const turnoId = Number(req.params.id);
      await ProcesionService.desapuntarmeDeTurno(userId, turnoId);
      res.status(200).json({ message: 'Te has borrado del turno.' });
    } catch (e) {
      handleHttp(res, e, 'Error al borrarse del turno');
    }
  }
}