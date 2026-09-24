import { Router } from 'express';
import { ReciboController } from '../controllers/recibo.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import { type } from 'arktype';
import { idParam } from '../config/common.js'; // Esquema para validar IDs numéricos en URL
import {
  adminRecibosQuerySchema,
  adminResumenQuerySchema,
  buscarHermanosQuerySchema,
  impagosQuerySchema,
  emitirReciboSchema,
  generarCuotasSchema,
  marcarPagadoSchema,
  misRecibosQuerySchema,
  updateReciboSchema
} from '../schemas/recibo.schema.js';
import { pagarEnLineaSchema } from '../schemas/procesion.schema.js';

const reciboRoutes = Router();

reciboRoutes.use(authenticateToken);

const validateId = validate(type({ params: { id: idParam } }));
const rolesTesoreria = [Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR];

// ==========================================
//  RUTAS DE USUARIO (Familia)
// ==========================================
reciboRoutes.get('/mis-recibos', validate(misRecibosQuerySchema), ReciboController.getMyRecibos);

// El detalle de un recibo propio. El filtro de familia está en el servicio
// (`getReciboFamiliar`), no aquí: esta ruta no distingue roles, cualquiera con
// sesión de hermano puede pedirla y solo verá lo suyo.
reciboRoutes.get('/mis-recibos/:id', validateId, ReciboController.getMyRecibo);

// Pagar en línea recibos de la familia. Hoy la pasarela está simulada: ver
// `pagoEnLineaDisponible` (en producción solo con PAGO_EN_LINEA=simulado).
reciboRoutes.post('/mis-recibos/pagar', validate(pagarEnLineaSchema), ReciboController.pagarEnLinea);

// ==========================================
//  RUTAS DE ADMIN (Tesorería, y ahora también el Hermano Mayor;
//  Secretaría nunca tuvo acceso aquí)
// ==========================================

reciboRoutes.get('/admin', checkRole(rolesTesoreria), validate(adminRecibosQuerySchema), ReciboController.getAdminRecibos);

// Los contadores por estado de encima del listado, con sus mismos filtros.
reciboRoutes.get('/admin/resumen', checkRole(rolesTesoreria), validate(adminResumenQuerySchema), ReciboController.getResumenAdmin);

// Quién debe cuotas. Lo consulta Tesorería, y también Secretaría, que es quien
// da las bajas por impago y no entra en el resto de Tesorería.
reciboRoutes.get('/admin/impagos',
  checkRole([...rolesTesoreria, Role.SECRETARIA]),
  validate(impagosQuerySchema),
  ReciboController.impagos
);

// Buscador para la ventana «Nuevo recibo»: Tesorería no entra en el del censo.
reciboRoutes.get('/admin/hermanos',
  checkRole(rolesTesoreria),
  validate(buscarHermanosQuerySchema),
  ReciboController.buscarHermanos
);

reciboRoutes.post('/admin',
  checkRole(rolesTesoreria),
  validate(emitirReciboSchema),
  ReciboController.emitir
);

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
