import { Router } from 'express';
import { ProcesionController } from '../controllers/procesion.controller.js';
import { MesaController } from '../controllers/mesa.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { type } from 'arktype';
import { idParam } from '../config/common.js'; 

// AHORA IMPORTAMOS TODO DESDE EL SCHEMA
import {
  avisarAsistenciaSchema,
  yearParamSchema,
  salidaQuerySchema,
  fechaRosarioSchema,
  mesaEsperadosSchema,
  mesaInscribirSchema,
  mesaCobrarSchema,
  mesaPerdonarSchema,
  mesaEntregarSchema,
  mesaEditarSolicitudSchema,
  mesaFichaSchema,
  mesaPreparacionSchema,
  crearTurnoSchema,
  procesarAusenciasSchema,
  misPapeletasQuerySchema,
  plazoPapeletasSchema,
  mesaBuscarSchema,
  mesaPrendasSchema,
  mesaListadoSchema,
  mesaAltaSchema,
  mesaCorregirSchema,
  mesaEditarPapeletaSchema,
  mesaDevolverSchema
} from '../schemas/procesion.schema.js';

const procesionRouter = Router();

procesionRouter.use(authenticateToken);

const validateId = validate(type({ params: { id: idParam } }));
const rolesMesaReparto = [Role.ADMIN, Role.TESORERIA, Role.SECRETARIA, Role.ALBACERIA];
const rolesJunta = [Role.ADMIN, Role.TESORERIA, Role.SECRETARIA, Role.ALBACERIA, Role.HERMANO_MAYOR];

// ==========================================
//  ZONA HERMANO (APP)
// ==========================================
procesionRouter.get('/dias', validate(salidaQuerySchema), ProcesionController.getDias);
procesionRouter.get('/mi-estado', ProcesionController.getMiEstado);
procesionRouter.post('/avisar', validate(avisarAsistenciaSchema), ProcesionController.avisarAsistencia);
procesionRouter.delete('/avisar/:id', validateId, ProcesionController.cancelarAsistencia);
procesionRouter.get('/mis-papeletas', validate(misPapeletasQuerySchema), ProcesionController.getMisPapeletas);

// ==========================================
//  ZONA ADMIN (MESA DE REPARTO)
// ==========================================
procesionRouter.get('/admin/hoy', checkRole(rolesMesaReparto), ProcesionController.getListadoHoy);
procesionRouter.delete('/admin/papeletas/:id/anular', checkRole(rolesMesaReparto), validateId, ProcesionController.anularPapeleta);

// ==========================================
//  ZONA ADMIN (LA MESA DE LA PROCESIÓN)
// ==========================================
// Buscar a la persona, darla de alta si no está, corregir sus datos o su
// papeleta, y las tres zonas: inscribir, cobrar (o perdonar) y dar la ropa.
const validateIdMesa = validate(type({ params: { id: idParam } }));
procesionRouter.get('/admin/mesa/apuntados', checkRole(rolesMesaReparto), validate(mesaListadoSchema), MesaController.listado);
procesionRouter.get('/admin/mesa/personas', checkRole(rolesMesaReparto), validate(mesaBuscarSchema), MesaController.buscar);
procesionRouter.get('/admin/mesa/esperados', checkRole(rolesMesaReparto), validate(mesaEsperadosSchema), MesaController.esperados);
procesionRouter.get('/admin/mesa/prendas', checkRole(rolesMesaReparto), validate(mesaPrendasSchema), MesaController.prendas);
procesionRouter.post('/admin/mesa/personas', checkRole(rolesMesaReparto), validate(mesaAltaSchema), MesaController.alta);
procesionRouter.get('/admin/mesa/personas/:id', checkRole(rolesMesaReparto), validate(mesaFichaSchema), MesaController.ficha);
procesionRouter.get('/admin/mesa/colas', checkRole(rolesMesaReparto), validate(salidaQuerySchema), MesaController.colas);
procesionRouter.get('/admin/mesa/preparacion', checkRole(rolesMesaReparto), validate(mesaPreparacionSchema), MesaController.preparacion);
procesionRouter.get('/admin/mesa/eventos', checkRole(rolesMesaReparto), MesaController.eventos);
procesionRouter.post('/admin/mesa/inscribir', checkRole(rolesMesaReparto), validate(mesaInscribirSchema), MesaController.inscribir);
procesionRouter.post('/admin/mesa/cobrar', checkRole(rolesMesaReparto), validate(mesaCobrarSchema), MesaController.cobrar);
// Perdonar lo decide el Hermano Mayor y lo marca Tesorería.
procesionRouter.post('/admin/mesa/perdonar', checkRole([Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR]), validate(mesaPerdonarSchema), MesaController.perdonar);
procesionRouter.post('/admin/mesa/entregar', checkRole(rolesMesaReparto), validate(mesaEntregarSchema), MesaController.entregar);
procesionRouter.post('/admin/mesa/devolver', checkRole(rolesMesaReparto), validate(mesaDevolverSchema), MesaController.devolver);
procesionRouter.get('/admin/mesa/sin-devolver', checkRole(rolesMesaReparto), MesaController.sinDevolver);
procesionRouter.get('/admin/mesa/cingulos', checkRole(rolesMesaReparto), MesaController.cingulos);
// Una solicitud sin recoger: se corrige o se cancela desde el listado.
procesionRouter.patch('/admin/solicitudes/:id', checkRole(rolesMesaReparto), validate(type({ params: { id: idParam } }).and(mesaEditarSolicitudSchema)), MesaController.editarSolicitud);
procesionRouter.delete('/admin/solicitudes/:id', checkRole(rolesMesaReparto), validateId, MesaController.cancelarSolicitud);
procesionRouter.patch('/admin/mesa/personas/:id', checkRole(rolesMesaReparto), validate(type({ params: { id: idParam } }).and(mesaCorregirSchema)), MesaController.corregir);
// Reactivar una baja o aprobar una solicitud es cosa del censo: Secretaría.
procesionRouter.post('/admin/mesa/personas/:id/activar', checkRole([Role.ADMIN, Role.SECRETARIA]), validateIdMesa, MesaController.activar);
procesionRouter.patch('/admin/papeletas/:id', checkRole(rolesMesaReparto), validate(type({ params: { id: idParam } }).and(mesaEditarPapeletaSchema)), MesaController.editarPapeleta);
// La papeleta en A4 para imprimirla en la mesa al dar la ropa (o reimprimirla).
procesionRouter.get('/admin/papeletas/:id/pdf', checkRole(rolesMesaReparto), validateIdMesa, MesaController.papeletaPdf);

// ==========================================
//  ZONA ADMIN (LISTADOS Y MANTENIMIENTO)
// ==========================================
procesionRouter.get('/admin/listado/:year', checkRole(rolesJunta), validate(yearParamSchema.and(salidaQuerySchema)), ProcesionController.getListadoProcesion);
procesionRouter.post('/admin/procesar-ausencias', checkRole([Role.ADMIN, Role.SECRETARIA]), validate(procesarAusenciasSchema), ProcesionController.procesarAusencias);

// ==========================================
//  ZONA ADMIN (GESTIÓN DE TURNOS DE REPARTO)
// ==========================================
procesionRouter.get('/admin/turnos', checkRole(rolesJunta), validate(salidaQuerySchema), ProcesionController.getTodosTurnos);
procesionRouter.post('/admin/turnos', checkRole([Role.ADMIN, Role.SECRETARIA]), validate(crearTurnoSchema), ProcesionController.crearTurno);
procesionRouter.delete('/admin/turnos/:id', checkRole([Role.ADMIN, Role.SECRETARIA]), validateId, ProcesionController.deleteTurno);

// El plazo de la solicitud en el área de hermanos: lo ve la Junta, lo cambia Secretaría.
procesionRouter.get('/admin/plazo', checkRole(rolesJunta), validate(salidaQuerySchema), ProcesionController.getPlazo);
procesionRouter.post('/admin/plazo', checkRole([Role.ADMIN, Role.SECRETARIA]), validate(plazoPapeletasSchema), ProcesionController.cambiarPlazo);
// La fecha del Rosario vespertino: la fija Secretaría y sale en la Agenda.
procesionRouter.put('/admin/rosario', checkRole([Role.ADMIN, Role.SECRETARIA]), validate(fechaRosarioSchema), ProcesionController.fijarRosario);

procesionRouter.get('/admin/cuadrante', checkRole(rolesJunta), ProcesionController.getCuadrante);
procesionRouter.post('/admin/turnos/:id/apuntarme', checkRole(rolesJunta), validateId, ProcesionController.apuntarmeTurno);
procesionRouter.delete('/admin/turnos/:id/desapuntarme', checkRole(rolesJunta), validateId, ProcesionController.desapuntarmeTurno);

export { procesionRouter as procesionRoutes };