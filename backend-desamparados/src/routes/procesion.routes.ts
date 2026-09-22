import { Router } from 'express';
import { ProcesionController } from '../controllers/procesion.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { type } from 'arktype';
import { idParam } from '../config/common.js'; 

// AHORA IMPORTAMOS TODO DESDE EL SCHEMA
import {
  avisarAsistenciaSchema,
  inscribirManualSchema,
  yearParamSchema,
  crearTurnoSchema,
  procesarAusenciasSchema,
  misPapeletasQuerySchema,
  plazoPapeletasSchema
} from '../schemas/procesion.schema.js';

const procesionRouter = Router();

procesionRouter.use(authenticateToken);

const validateId = validate(type({ params: { id: idParam } }));
const rolesMesaReparto = [Role.ADMIN, Role.TESORERIA, Role.SECRETARIA, Role.ALBACERIA];
const rolesJunta = [Role.ADMIN, Role.TESORERIA, Role.SECRETARIA, Role.ALBACERIA, Role.HERMANO_MAYOR];

// ==========================================
//  ZONA HERMANO (APP)
// ==========================================
procesionRouter.get('/dias', ProcesionController.getDias);
procesionRouter.get('/mi-estado', ProcesionController.getMiEstado);
procesionRouter.post('/avisar', validate(avisarAsistenciaSchema), ProcesionController.avisarAsistencia);
procesionRouter.delete('/avisar/:id', validateId, ProcesionController.cancelarAsistencia);
procesionRouter.get('/mis-papeletas', validate(misPapeletasQuerySchema), ProcesionController.getMisPapeletas);

// ==========================================
//  ZONA ADMIN (MESA DE REPARTO)
// ==========================================
procesionRouter.get('/admin/hoy', checkRole(rolesMesaReparto), ProcesionController.getListadoHoy);
procesionRouter.post('/admin/inscribir', checkRole(rolesMesaReparto), validate(inscribirManualSchema), ProcesionController.inscribirManual);
procesionRouter.delete('/admin/papeletas/:id/anular', checkRole(rolesMesaReparto), validateId, ProcesionController.anularPapeleta);

// ==========================================
//  ZONA ADMIN (LISTADOS Y MANTENIMIENTO)
// ==========================================
procesionRouter.get('/admin/listado/:year', checkRole(rolesJunta), validate(yearParamSchema), ProcesionController.getListadoProcesion);
procesionRouter.post('/admin/procesar-ausencias', checkRole([Role.ADMIN, Role.SECRETARIA]), validate(procesarAusenciasSchema), ProcesionController.procesarAusencias);

// ==========================================
//  ZONA ADMIN (GESTIÓN DE TURNOS DE REPARTO)
// ==========================================
procesionRouter.get('/admin/turnos', checkRole(rolesJunta), ProcesionController.getTodosTurnos);
procesionRouter.post('/admin/turnos', checkRole([Role.ADMIN, Role.SECRETARIA]), validate(crearTurnoSchema), ProcesionController.crearTurno);
procesionRouter.delete('/admin/turnos/:id', checkRole([Role.ADMIN, Role.SECRETARIA]), validateId, ProcesionController.deleteTurno);

// El plazo de la solicitud en el área de hermanos: lo ve la Junta, lo cambia Secretaría.
procesionRouter.get('/admin/plazo', checkRole(rolesJunta), ProcesionController.getPlazo);
procesionRouter.post('/admin/plazo', checkRole([Role.ADMIN, Role.SECRETARIA]), validate(plazoPapeletasSchema), ProcesionController.cambiarPlazo);

procesionRouter.get('/admin/cuadrante', checkRole(rolesJunta), ProcesionController.getCuadrante);
procesionRouter.post('/admin/turnos/:id/apuntarme', checkRole(rolesJunta), validateId, ProcesionController.apuntarmeTurno);
procesionRouter.delete('/admin/turnos/:id/desapuntarme', checkRole(rolesJunta), validateId, ProcesionController.desapuntarmeTurno);

export { procesionRouter as procesionRoutes };