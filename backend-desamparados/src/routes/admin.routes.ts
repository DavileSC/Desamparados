import { Router } from 'express';
import { type } from 'arktype';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js'; 
import { promoteUserSchema, demoteUserSchema, updateConfigSchema } from '../schemas/admin.schema.js';

const adminRoutes = Router();

// Middleware Global
adminRoutes.use(authenticateToken);
adminRoutes.use(checkRole([Role.ADMIN]));

// --- GESTIÓN DE USUARIOS Y ROLES ---
adminRoutes.get('/staff', AdminController.getStaff);
adminRoutes.get('/users/search', AdminController.searchUsers);
adminRoutes.post('/staff/promote', validate(promoteUserSchema), AdminController.promote);
adminRoutes.post('/staff/demote', validate(demoteUserSchema), AdminController.demote);

// --- GESTIÓN DE CONFIGURACIÓN GLOBAL ---

// Obtener todos los parámetros de configuración
adminRoutes.get('/config', AdminController.getAllConfig);

// Actualizar un parámetro de configuración (ej: precios, límite de noticias)
adminRoutes.post('/config', validate(updateConfigSchema), AdminController.updateConfig);

// --- REGISTRO DE AUDITORÍA (Quién hizo qué) ---
adminRoutes.get('/audit-logs', AdminController.getAuditLogs);

export { adminRoutes };