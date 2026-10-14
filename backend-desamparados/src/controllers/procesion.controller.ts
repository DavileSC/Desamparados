import { MiProcesionService } from '../services/procesion/mi-procesion.service.js';
import { PapeletasService } from '../services/procesion/papeletas.service.js';
import { TurnosService } from '../services/procesion/turnos.service.js';
import { PlazoPapeletasService } from '../services/procesion/plazo.service.js';
import { SalidasService, salidaDe } from '../services/procesion/salidas.service.js';
import { handleHttp, HttpError } from '../utils/error.handle.js';
import { instanteLimiteAusencias } from '../domain/datos-procesion.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class ProcesionController {

  // ============================================================
  //  ZONA HERMANO (APP)
  // ============================================================

  static getDias = manejar('Error obteniendo días', async (req, res) => {
    const dias = await MiProcesionService.getDiasDisponibles(await salidaDe(req));
    res.json(dias);
  });

  static getMiEstado = manejar('Error obteniendo tu procesión', async (req, res) => {
    res.json(await MiProcesionService.getMiEstado(req.user!.id));
  });

  static getPlazo = manejar('Error obteniendo el plazo de papeletas', async (req, res) => {
    const salida = await salidaDe(req);
    const plazo = await PlazoPapeletasService.estadoParaSecretaria(salida);
    // Las de fecha a mano enseñan junto al interruptor el acto que la fija (o que falta).
    res.json(salida.fecha === 'MANUAL' ? { ...plazo, fecha: SalidasService.fecha(salida) } : plazo);
  });

  static avisoPrevisto = manejar('No se ha podido calcular a quién llegaría el aviso', async (_req, res) => {
    res.status(200).json(await PlazoPapeletasService.avisoPrevisto());
  });

  static cambiarPlazo = manejar('Error cambiando el plazo de papeletas', async (req, res) => {
    const { abierto, avisar, borradorNoticia } = req.body as { abierto: boolean; avisar?: boolean; borradorNoticia?: boolean };
    const resultado = await PlazoPapeletasService.cambiar(abierto, { avisar, borradorNoticia }, await salidaDe(req), AuditoriaService.metaFromReq(req));
    res.json(resultado);
  });

  static avisarAsistencia = manejar('Error al pedir la papeleta', async (req, res) => {
    const userId = req.user!.id;
    const data = await MiProcesionService.avisarAsistencia(userId, req.body, AuditoriaService.metaFromReq(req));
    res.status(201).json(data);
  });

  static cancelarAsistencia = manejar('Error al cancelar la cita', async (req, res) => {
    const userId = req.user!.id;
    const citaId = Number(req.params.id);
    await MiProcesionService.cancelarAsistencia(userId, citaId, AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: 'Cita cancelada correctamente.' });
  });

  static cambiarDia = manejar('Error al cambiar de día', async (req, res) => {
    const data = await MiProcesionService.cambiarDia(req.user!.id, Number(req.params.id), (req.body as { turnoId: number }).turnoId, AuditoriaService.metaFromReq(req));
    res.json(data);
  });

  static getMisPapeletas = manejar('Error obteniendo el historial de papeletas', async (req, res) => {
    const userId = req.user!.id;
    const papeletas = await MiProcesionService.getMisPapeletas(userId, req.query);
    res.status(200).json(papeletas);
  });

  // ============================================================
  //  ZONA ADMIN (La mesa de reparto)
  // ============================================================

  static getListadoHoy = manejar('Error obteniendo listado de hoy', async (_req, res) => {
    const lista = await PapeletasService.getAsistentesDelDia(new Date());
    res.json(lista);
  });

  static anularPapeleta = manejar('Error al anular la papeleta', async (req, res) => {
    const papeletaId = Number(req.params.id);
    const result = await PapeletasService.anularPapeleta(papeletaId, AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  // ============================================================
  //  ZONA ADMIN (Listados Finales y Mantenimiento)
  // ============================================================

  static getListadoProcesion = manejar('Error generando el censo de la procesión', async (req, res) => {
    const year = Number(req.params.year);
    const listado = await PapeletasService.getListadoProcesion(year, await salidaDe(req));
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

    const result = await PapeletasService.procesarAusencias(limite, cierreDefinitivo, AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  // ============================================================
  //  ZONA ADMIN (Gestión de Turnos y Voluntariado)
  // ============================================================

  static getTodosTurnos = manejar('Error obteniendo los turnos', async (req, res) => {
    const turnos = await TurnosService.getTodosLosTurnos(await salidaDe(req));
    res.status(200).json(turnos);
  });

  static crearTurno = manejar('Error creando el turno', async (req, res) => {
    const nuevoTurno = await TurnosService.crearTurno(req.body, await salidaDe(req), AuditoriaService.metaFromReq(req));
    res.status(201).json(nuevoTurno);
  });

  static deleteTurno = manejar('Error eliminando turno', async (req, res) => {
    const turnoId = Number(req.params.id);
    await TurnosService.eliminarTurno(turnoId, AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: 'Turno eliminado correctamente' });
  });

  static getCuadrante = manejar('Error obteniendo cuadrante de la Junta', async (_req, res) => {
    const cuadrante = await TurnosService.getCuadranteTurnos();
    res.status(200).json(cuadrante);
  });

  static apuntarmeTurno = manejar('Error al apuntarse al turno', async (req, res) => {
    const userId = req.user!.id; 
    const turnoId = Number(req.params.id);
    await TurnosService.apuntarmeATurno(userId, turnoId);
    res.status(200).json({ message: 'Te has apuntado al turno correctamente.' });
  });

  static desapuntarmeTurno = manejar('Error al borrarse del turno', async (req, res) => {
    const userId = req.user!.id; 
    const turnoId = Number(req.params.id);
    await TurnosService.desapuntarmeDeTurno(userId, turnoId);
    res.status(200).json({ message: 'Te has borrado del turno.' });
  });
}