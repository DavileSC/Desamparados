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
  createPrendaSchema, updatePrendaSchema, queryPrendaSchema,
  asignarPrendaSchema, devolverPrendaSchema, numeroHermanoParamSchema
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
inventarioRoutes.get('/enseres/:id', checkRole(rolesGestores), validateId, InventarioController.getOneEnser);

// GESTIÓN (Solo roles autorizados)
inventarioRoutes.post('/enseres', checkRole(rolesGestores), validate(createEnserSchema), InventarioController.createEnser);
inventarioRoutes.put('/enseres/:id', checkRole(rolesGestores), validateId, validate(updateEnserSchema), InventarioController.updateEnser);
inventarioRoutes.delete('/enseres/:id', checkRole(rolesGestores), validateId, InventarioController.deleteEnser);


// ==========================================
// --- 2. ROPERO (Mayordomía - Unitario) ---
// Rutas base: /inventario/prendas/...
// ==========================================

// LECTURA (solo gestores): cada prenda prestada lleva el nombre, los apellidos
// y el número de hermano de quien la tiene. Sin el checkRole, cualquier hermano
// raso con sesión veía quién tiene cada túnica.
inventarioRoutes.get('/prendas', checkRole(rolesGestores), validate(queryPrendaSchema), InventarioController.listPrendas);
// Va DESPUÉS de '/prendas' y ANTES de las rutas de acción, igual que en el
// bloque de enseres. ':id' se traga cualquier segmento suelto, así que
// cualquier GET literal que se añada aquí ('/prendas/disponibles'...) tiene que
// declararse por encima de esta línea o no llegará nunca a su controlador.
inventarioRoutes.get('/prendas/:id', checkRole(rolesGestores), validateId, InventarioController.getOnePrenda);

// GESTIÓN BÁSICA DE PRENDAS
inventarioRoutes.post('/prendas', checkRole(rolesGestores), validate(createPrendaSchema), InventarioController.createPrenda);
inventarioRoutes.put('/prendas/:id', checkRole(rolesGestores), validateId, validate(updatePrendaSchema), InventarioController.updatePrenda);
inventarioRoutes.delete('/prendas/:id', checkRole(rolesGestores), validateId, InventarioController.deletePrenda);

// --- LÓGICA DE ASIGNACIONES (PRÉSTAMOS) ---

// Antes de prestar, el CMS enseña a quién: nombre y apellidos del hermano con
// ese número. Cuelga de '/hermanos' y no de '/prendas' para que ningún
// '/prendas/:id' se lo trague.
inventarioRoutes.get('/hermanos/:numeroHermano', checkRole(rolesGestores), validate(numeroHermanoParamSchema), InventarioController.buscarHermano);

// Rutas de acción
inventarioRoutes.post('/prendas/:id/asignar', checkRole(rolesGestores), validateId, validate(asignarPrendaSchema), InventarioController.asignarPrenda);
inventarioRoutes.post('/prendas/:id/devolver', checkRole(rolesGestores), validateId, validate(devolverPrendaSchema), InventarioController.devolverPrenda);


export { inventarioRoutes };