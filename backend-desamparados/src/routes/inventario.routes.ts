import { Router } from 'express';
import { InventarioController } from '../controllers/inventario.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { type } from 'arktype';
import { idParam } from '../config/common.js'; 

// Importamos todos los esquemas (Enseres y Prendas)
import { 
  createEnserSchema, updateEnserSchema, queryEnserSchema,
  createPrendaSchema, updatePrendaSchema, queryPrendaSchema 
} from '../schemas/inventario.schema.js';

const inventarioRoutes = Router();

// Middleware Global: Nadie entra sin JWT
inventarioRoutes.use(authenticateToken);

// Validador común para los :id
const validateId = validate(type({ params: { id: idParam } }));

// Roles para gestión (Ajusta Role.MAYORDOMIA si lo tienes, o usa ALBACERIA/SECRETARIA)
const rolesGestores = [Role.ADMIN, Role.ALBACERIA, Role.HERMANO_MAYOR];

// ==========================================
// --- DASHBOARD GLOBAL ---
// ==========================================
// Va suelto y arriba para que no choque con los /:id
inventarioRoutes.get('/dashboard', InventarioController.dashboard); 


// ==========================================
// --- 1. ENSERES (Albacería - Lotes) ---
// Rutas base: /inventario/enseres/...
// ==========================================

// LECTURA (Todos los hermanos pueden ver el patrimonio)
inventarioRoutes.get('/enseres', validate(queryEnserSchema), InventarioController.listEnseres);       
inventarioRoutes.get('/enseres/:id', validateId, InventarioController.getOneEnser);  

// GESTIÓN (Solo roles autorizados)
inventarioRoutes.post('/enseres', checkRole(rolesGestores), validate(createEnserSchema), InventarioController.createEnser);
inventarioRoutes.put('/enseres/:id', checkRole(rolesGestores), validateId, validate(updateEnserSchema), InventarioController.updateEnser);
inventarioRoutes.delete('/enseres/:id', checkRole(rolesGestores), validateId, InventarioController.deleteEnser);


// ==========================================
// --- 2. ROPERO (Mayordomía - Unitario) ---
// Rutas base: /inventario/prendas/...
// ==========================================

// LECTURA 
inventarioRoutes.get('/prendas', validate(queryPrendaSchema), InventarioController.listPrendas);       

// GESTIÓN BÁSICA DE PRENDAS
inventarioRoutes.post('/prendas', checkRole(rolesGestores), validate(createPrendaSchema), InventarioController.createPrenda);
inventarioRoutes.put('/prendas/:id', checkRole(rolesGestores), validateId, validate(updatePrendaSchema), InventarioController.updatePrenda);
inventarioRoutes.delete('/prendas/:id', checkRole(rolesGestores), validateId, InventarioController.deletePrenda);

// --- LÓGICA DE ASIGNACIONES (PRÉSTAMOS) ---

// Validadores inline rápidos y seguros para los préstamos
const asignarSchema = validate(type({ body: { hermanoId: "number > 0" } }));
const devolverSchema = validate(type({ body: { "necesitaLavado?": "boolean" } }));

// Rutas de acción
inventarioRoutes.post('/prendas/:id/asignar', checkRole(rolesGestores), validateId, asignarSchema, InventarioController.asignarPrenda);
inventarioRoutes.post('/prendas/:id/devolver', checkRole(rolesGestores), validateId, devolverSchema, InventarioController.devolverPrenda);


export { inventarioRoutes };