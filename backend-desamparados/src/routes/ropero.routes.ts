import { Router } from 'express';
import { Role } from '@prisma/client';
import { type } from 'arktype';
import { InventarioController } from '../controllers/inventario.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import {
  createPrendaSchema, updatePrendaSchema, queryPrendaSchema,
  asignarPrendaSchema, devolverPrendaSchema, numeroHermanoParamSchema, prendasLavadasSchema, totalCingulosSchema,
} from '../schemas/inventario.schema.js';

/**
 * El ropero (túnicas, prendas y cíngulos) es parte de Procesión, no del
 * Inventario: toda corporación tiene túnica y la mesa escribe en `Prenda`.
 * Vivía en /api/inventario; con los módulos se monta en /api/ropero con la
 * guarda de `procesion`, para que apagar el Inventario (los enseres) no se
 * lleve el ropero. Los controladores siguen siendo los del inventario.
 */
const roperoRoutes = Router();
roperoRoutes.use(authenticateToken);
const validateId = validate(type({ params: { id: idParam } }));
const rolesGestores = [Role.ADMIN, Role.ALBACERIA, Role.HERMANO_MAYOR];

// LECTURA (solo gestores): cada prenda prestada lleva el nombre, los apellidos
// y el número de hermano de quien la tiene. Sin el checkRole, cualquier hermano
// raso con sesión veía quién tiene cada túnica.
roperoRoutes.get('/prendas', checkRole(rolesGestores), validate(queryPrendaSchema), InventarioController.listPrendas);
// ':id' se traga cualquier segmento suelto: un GET literal nuevo ('/prendas/disponibles'…) va por encima de esta línea.
roperoRoutes.get('/prendas/:id', checkRole(rolesGestores), validateId, InventarioController.getOnePrenda);
roperoRoutes.post('/prendas', checkRole(rolesGestores), validate(createPrendaSchema), InventarioController.createPrenda);
roperoRoutes.put('/prendas/:id', checkRole(rolesGestores), validateId, validate(updatePrendaSchema), InventarioController.updatePrenda);
roperoRoutes.delete('/prendas/:id', checkRole(rolesGestores), validateId, InventarioController.deletePrenda);
// Antes de prestar, el CMS enseña a quién. Cuelga de '/hermanos' para que ningún '/prendas/:id' se lo trague.
roperoRoutes.get('/hermanos/:numeroHermano', checkRole(rolesGestores), validate(numeroHermanoParamSchema), InventarioController.buscarHermano);
roperoRoutes.post('/prendas/:id/asignar', checkRole(rolesGestores), validateId, validate(asignarPrendaSchema), InventarioController.asignarPrenda);
roperoRoutes.post('/prendas/:id/devolver', checkRole(rolesGestores), validateId, validate(devolverPrendaSchema), InventarioController.devolverPrenda);
// Las del lavado que ya están limpias vuelven a estar disponibles.
roperoRoutes.post('/prendas/lavadas', checkRole(rolesGestores), validate(prendasLavadasSchema), InventarioController.prendasLavadas);
// Los cíngulos no van numerados: se cuentan.
roperoRoutes.get('/cingulos', checkRole(rolesGestores), InventarioController.cingulos);
roperoRoutes.put('/cingulos', checkRole(rolesGestores), validate(totalCingulosSchema), InventarioController.cambiarCingulos);

export { roperoRoutes };
