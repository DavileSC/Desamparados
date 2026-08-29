import { Router } from 'express';
import { Role } from '@prisma/client';
import { PanelController } from '../controllers/panel.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';

const panelRoutes = Router();

// El panel lo ve toda la junta de gobierno: los roles acotan la edición, no la
// lectura de las cifras de conjunto. Un USER (hermano raso) no entra al CMS.
const ROLES_STAFF = [
  Role.ADMIN,
  Role.HERMANO_MAYOR,
  Role.SECRETARIA,
  Role.TESORERIA,
  Role.REDES,
  Role.ALBACERIA,
];

panelRoutes.use(authenticateToken);
panelRoutes.use(checkRole(ROLES_STAFF));

panelRoutes.get('/', PanelController.get);

export { panelRoutes };
