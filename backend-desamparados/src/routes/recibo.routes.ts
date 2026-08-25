import { Router } from 'express';
import { ReciboController } from '../controllers/recibo.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { type } from 'arktype';
import { idParam } from '../config/common.js'; // Esquema para validar IDs numéricos en URL
import { generarCuotasSchema, marcarPagadoSchema, updateReciboSchema } from '../schemas/recibo.schema.js';

const reciboRoutes = Router();

reciboRoutes.use(authenticateToken);

const validateId = validate(type({ params: { id: idParam } }));
const rolesTesoreria = [Role.ADMIN, Role.TESORERIA];

// ==========================================
//  RUTAS DE USUARIO (Familia)
// ==========================================
reciboRoutes.get('/mis-recibos', ReciboController.getMyRecibos);

// ==========================================
//  RUTAS DE ADMIN (Tesorería / Secretaría)
// ==========================================

reciboRoutes.post('/admin/generar', 
  checkRole(rolesTesoreria), 
  validate(generarCuotasSchema), // <-- Escudo contra importes negativos
  ReciboController.generarCuotas
);

reciboRoutes.post('/admin/:id/pagar', 
  checkRole(rolesTesoreria), 
  validateId,
  validate(marcarPagadoSchema),
  ReciboController.marcarPagado
);

reciboRoutes.put('/admin/:id', 
  checkRole(rolesTesoreria), 
  validateId, 
  validate(updateReciboSchema), // Solo admite campos válidos
  ReciboController.updateDetalles
);

export { reciboRoutes };
