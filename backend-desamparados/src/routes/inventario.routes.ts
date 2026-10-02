import { Router } from 'express';
import { InventarioController } from '../controllers/inventario.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { type } from 'arktype';
import { idParam } from '../config/common.js'; 

// Importamos los esquemas de Enseres. Los de Prendas/Ropero viven en ropero.routes.ts.
import {
  createEnserSchema, updateEnserSchema, queryEnserSchema
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
// Va suelto y arriba para que no choque con los /:id. Solo para quien gestiona
// el inventario, como el resto: ninguna pantalla fuera del CMS lo usa.
inventarioRoutes.get('/dashboard', checkRole(rolesGestores), InventarioController.dashboard);


// ==========================================
// --- 1. ENSERES (Albacería - Lotes) ---
// Rutas base: /inventario/enseres/...
// ==========================================

// LECTURA. Antes abierta a cualquier hermano con sesión («un enser no lleva
// datos personales»), pero cada enser lleva su `ubicacion`: la API le decía a
// cualquier cuenta dónde se guardan las piezas de valor. Solo quien lo gestiona.
inventarioRoutes.get('/enseres', checkRole(rolesGestores), validate(queryEnserSchema), InventarioController.listEnseres);
// Categorías y ubicaciones en uso, para los filtros del listado. Por encima de
// '/enseres/:id', que se tragaría el segmento.
inventarioRoutes.get('/enseres/opciones', checkRole(rolesGestores), InventarioController.opcionesEnseres);
inventarioRoutes.get('/enseres/:id', checkRole(rolesGestores), validateId, InventarioController.getOneEnser);
// La ficha en PDF, para el seguro, el Obispado o una restauración.
inventarioRoutes.get('/enseres/:id/ficha', checkRole(rolesGestores), validateId, InventarioController.fichaEnser);

// GESTIÓN (Solo roles autorizados)
inventarioRoutes.post('/enseres', checkRole(rolesGestores), validate(createEnserSchema), InventarioController.createEnser);
inventarioRoutes.put('/enseres/:id', checkRole(rolesGestores), validateId, validate(updateEnserSchema), InventarioController.updateEnser);
inventarioRoutes.delete('/enseres/:id', checkRole(rolesGestores), validateId, InventarioController.deleteEnser);

// El ropero (prendas, cíngulos y la búsqueda por número de hermano) está en
// ropero.routes.ts, montado en /api/ropero: es de Procesión, no del Inventario.

export { inventarioRoutes };