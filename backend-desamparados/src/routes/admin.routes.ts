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
// Suelo de seguridad: nadie fuera de estos dos entra en /api/admin, ni siquiera
// a una ruta que se añada mañana y se olvide de declarar su checkRole. Cada ruta
// estrecha después lo que le corresponde.
adminRoutes.use(checkRole([Role.ADMIN, Role.HERMANO_MAYOR]));

// Los permisos van ruta por ruta: el Hermano Mayor lee la auditoría, pero la
// gestión de cargos y la configuración siguen siendo del ADMIN, que es el rol
// técnico. El suelo de arriba ya bloquea a cualquier otro rol; esto estrecha
// más para las rutas que ni al Hermano Mayor le tocan.
const SOLO_ADMIN = [Role.ADMIN];
const LECTURA_AUDITORIA = [Role.ADMIN, Role.HERMANO_MAYOR];

// --- GESTIÓN DE USUARIOS Y ROLES ---
adminRoutes.get('/staff', checkRole(SOLO_ADMIN), AdminController.getStaff);
adminRoutes.get('/users/search', checkRole(SOLO_ADMIN), AdminController.searchUsers);
adminRoutes.post('/staff/promote', checkRole(SOLO_ADMIN), validate(promoteUserSchema), AdminController.promote);
adminRoutes.post('/staff/demote', checkRole(SOLO_ADMIN), validate(demoteUserSchema), AdminController.demote);

// --- GESTIÓN DE CONFIGURACIÓN GLOBAL ---

// Obtener todos los parámetros de configuración
adminRoutes.get('/config', checkRole(SOLO_ADMIN), AdminController.getAllConfig);

// Actualizar un parámetro de configuración (ej: precios, límite de noticias)
adminRoutes.post('/config', checkRole(SOLO_ADMIN), validate(updateConfigSchema), AdminController.updateConfig);

// --- REGISTRO DE AUDITORÍA (Quién hizo qué) ---
adminRoutes.get('/audit-logs', checkRole(LECTURA_AUDITORIA), AdminController.getAuditLogs);

export { adminRoutes };