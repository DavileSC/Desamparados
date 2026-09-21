import { ProcesionService } from '../services/procesion.service.js';
import { handleHttp, HttpError } from '../utils/error.handle.js';
import { instanteLimiteAusencias } from '../domain/datos-procesion.js';
import { AuditService } from '../services/audit.service.js';
import { manejar } from '../utils/manejar.js';

export class ProcesionController {

  // ============================================================
  //  ZONA HERMANO (APP)
  // ============================================================

  static getDias = manejar('Error obteniendo días', async (_req, res) => {
    const dias = await ProcesionService.getDiasDisponibles();
    res.json(dias);
  });

  static avisarAsistencia = manejar('Error al avisar asistencia', async (req, res) => {
    const userId = req.user!.id; 
    const data = await ProcesionService.avisarAsistencia(userId, req.body);
    res.status(201).json(data);
  });

  static cancelarAsistencia = manejar('Error al cancelar la cita', async (req, res) => {
    const userId = req.user!.id;
    const citaId = Number(req.params.id);
    await ProcesionService.cancelarAsistencia(userId, citaId);
    res.status(200).json({ message: 'Cita cancelada correctamente.' });
  });

  static getMisPapeletas = manejar('Error obteniendo el historial de papeletas', async (req, res) => {
    const userId = req.user!.id;
    const papeletas = await ProcesionService.getMisPapeletas(userId, req.query);
    res.status(200).json(papeletas);
  });

  // ============================================================
  //  ZONA ADMIN (La mesa de reparto)
  // ============================================================

  static getListadoHoy = manejar('Error obteniendo listado de hoy', async (_req, res) => {
    const lista = await ProcesionService.getAsistentesDelDia(new Date());
    res.json(lista);
  });

  static inscribirManual = manejar('Error al realizar inscripción', async (req, res) => {
    const result = await ProcesionService.inscribirYFacturar(req.body, AuditService.metaFromReq(req));
    res.status(200).json({
      msg: 'Inscripción realizada. Recibo generado y correo enviado.',
      data: result
    });
  });

  static anularPapeleta = manejar('Error al anular la papeleta', async (req, res) => {
    const papeletaId = Number(req.params.id);
    const result = await ProcesionService.anularPapeleta(papeletaId, AuditService.metaFromReq(req));
    res.status(200).json(result);
  });

  // ============================================================
  //  ZONA ADMIN (Listados Finales y Mantenimiento)
  // ============================================================

  static getListadoProcesion = manejar('Error generando el censo de la procesión', async (req, res) => {
    const year = Number(req.params.year);
    const listado = await ProcesionService.getListadoProcesion(year);
    res.status(200).json(listado);
  });

  static procesarAusencias = manejar('Error procesando ausencias', async (req, res) => {
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
  });

  // ============================================================
  //  ZONA ADMIN (Gestión de Turnos y Voluntariado)
  // ============================================================

  static getTodosTurnos = manejar('Error obteniendo los turnos', async (_req, res) => {
    const turnos = await ProcesionService.getTodosLosTurnos();
    res.status(200).json(turnos);
  });

  static crearTurno = manejar('Error creando el turno', async (req, res) => {
    const nuevoTurno = await ProcesionService.crearTurno(req.body, AuditService.metaFromReq(req));
    res.status(201).json(nuevoTurno);
  });

  static deleteTurno = manejar('Error eliminando turno', async (req, res) => {
    const turnoId = Number(req.params.id);
    await ProcesionService.eliminarTurno(turnoId, AuditService.metaFromReq(req));
    res.status(200).json({ message: 'Turno eliminado correctamente' });
  });

  static getCuadrante = manejar('Error obteniendo cuadrante de la Junta', async (_req, res) => {
    const cuadrante = await ProcesionService.getCuadranteTurnos();
    res.status(200).json(cuadrante);
  });

  static apuntarmeTurno = manejar('Error al apuntarse al turno', async (req, res) => {
    const userId = req.user!.id; 
    const turnoId = Number(req.params.id);
    await ProcesionService.apuntarmeATurno(userId, turnoId);
    res.status(200).json({ message: 'Te has apuntado al turno correctamente.' });
  });

  static desapuntarmeTurno = manejar('Error al borrarse del turno', async (req, res) => {
    const userId = req.user!.id; 
    const turnoId = Number(req.params.id);
    await ProcesionService.desapuntarmeDeTurno(userId, turnoId);
    res.status(200).json({ message: 'Te has borrado del turno.' });
  });
}