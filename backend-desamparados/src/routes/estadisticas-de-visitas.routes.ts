import { Router } from 'express';
import { Role } from '@prisma/client';
import { EstadisticasDeVisitasController } from '../controllers/estadisticas-de-visitas.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';

/** Web → «Estadísticas de visitas»: Administración y el Hermano Mayor. */
const estadisticasDeVisitasRouter = Router();
estadisticasDeVisitasRouter.use(authenticateToken);
estadisticasDeVisitasRouter.use(checkRole([Role.ADMIN, Role.HERMANO_MAYOR]));
estadisticasDeVisitasRouter.get('/', EstadisticasDeVisitasController.estado);
estadisticasDeVisitasRouter.get('/informe', EstadisticasDeVisitasController.informe);

export default estadisticasDeVisitasRouter;
