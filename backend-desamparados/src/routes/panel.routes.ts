import { Router } from 'express';
import { Role } from '@prisma/client';
import { PanelController } from '../controllers/panel.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { type } from 'arktype';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import { crearAvisoSchema, retabloSchema } from '../schemas/aviso.schema.js';

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

// Los avisos de la junta: cualquiera de la junta los crea; darlos por hecho lo
// decide el servicio (quien lo recibe, quien lo creó, el Hermano Mayor o Administración).
panelRoutes.post('/avisos', validate(crearAvisoSchema), PanelController.crearAviso);
panelRoutes.post('/avisos/:id/hecho', validate(type({ params: { id: idParam } })), PanelController.avisoHecho);

// La foto del retablo: la ve toda la junta en el Inicio, la cambian el Hermano Mayor y Administración.
const ROLES_RETABLO = [Role.ADMIN, Role.HERMANO_MAYOR];
panelRoutes.get('/retablo', checkRole(ROLES_RETABLO), PanelController.leerRetablo);
panelRoutes.put('/retablo', checkRole(ROLES_RETABLO), validate(retabloSchema), PanelController.guardarRetablo);

export { panelRoutes };
