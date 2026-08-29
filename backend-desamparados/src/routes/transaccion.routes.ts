import { Router } from 'express';
import { TransaccionController } from '../controllers/transaccion.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { createCategoriaSchema, createTransaccionSchema } from '../schemas/transaccion.schema.js';


const transaccionRoutes = Router();

// Nadie entra sin estar logueado y sin ser del equipo económico
transaccionRoutes.use(authenticateToken);
transaccionRoutes.use(checkRole([Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR]));

// Rutas
// --- GESTIÓN DE CATEGORÍAS ---
transaccionRoutes.get('/categorias', TransaccionController.getCategorias);
transaccionRoutes.post('/categorias', validate(createCategoriaSchema), TransaccionController.createCategoria);

// --- LIBRO MAYOR ---
transaccionRoutes.get('/libro-mayor', TransaccionController.getLibroMayor);
transaccionRoutes.get('/balance', TransaccionController.getDashboard);
transaccionRoutes.post('/', validate(createTransaccionSchema), TransaccionController.create);

export { transaccionRoutes };