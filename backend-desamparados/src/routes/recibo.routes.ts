import { Router } from 'express';
import { ReciboController } from '../controllers/recibo.controller.js';
import { Modelo182Controller } from '../controllers/modelo-182.controller.js';
import { certificadosQuerySchema } from '../schemas/modelo-182.schema.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { conModulo } from '../middleware/modulos.js';
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
import { estadoDePagoSchema, pagarEnLineaSchema } from '../schemas/procesion.schema.js';
import { remesasRoutes } from './remesas.routes.js';
import { modelo182Routes } from './modelo-182.routes.js';

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
// Los certificados de donativos de su cuenta, para la renta. Antes de
// `/mis-recibos/:id`: si no, «certificados» se leería como un id y daría 400.
reciboRoutes.get('/mis-recibos/certificados', conModulo('modelo-182'), Modelo182Controller.misCertificados);
reciboRoutes.get('/mis-recibos/certificados/pdf', conModulo('modelo-182'), validate(certificadosQuerySchema), Modelo182Controller.miCertificado);
reciboRoutes.get('/mis-recibos/:id', validateId, ReciboController.getMyRecibo);

// Pagar en línea recibos de la familia: con Redsys devuelve el formulario
// para ir al banco; simulado, cobra en el acto (ver `modoDePago`).
reciboRoutes.post('/mis-recibos/pagar', conModulo('cuotas-en-linea'), validate(pagarEnLineaSchema), ReciboController.pagarEnLinea);

// Cómo va un pago propio, a la vuelta del banco. Filtra por usuario en el servicio.
reciboRoutes.get('/mis-recibos/pagos/:pedido', conModulo('cuotas-en-linea'), validate(estadoDePagoSchema), ReciboController.estadoDelPago);

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

// Lo que el banco cobró y no se pudo aplicar: Tesorería lo devuelve y lo da por resuelto.
reciboRoutes.get('/admin/pagos-en-linea/incidencias', checkRole(rolesTesoreria), ReciboController.incidenciasDePago);
reciboRoutes.post('/admin/pagos-en-linea/incidencias/:id/resolver', checkRole(rolesTesoreria), validateId, ReciboController.resolverIncidencia);

// El Modelo 182 y las remesas (con la Norma 43) son módulos: cada uno en su
// router, montado aquí con su guarda para conservar la dirección. Antes de
// `/admin/:id`, que se tragaría «remesas» y «modelo-182» como un id.
reciboRoutes.use('/admin/modelo-182', conModulo('modelo-182'), modelo182Routes);
reciboRoutes.use('/admin/remesas', conModulo('remesas'), remesasRoutes);

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
