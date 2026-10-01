import { Router } from 'express';
import { ReciboController } from '../controllers/recibo.controller.js';
import { RemesaController } from '../controllers/remesa.controller.js';
import { Norma43Controller } from '../controllers/norma43.controller.js';
import { Modelo182Controller } from '../controllers/modelo-182.controller.js';
import { certificadosQuerySchema, configuracionModelo182Schema, ejercicioQuerySchema, ficheroModelo182Schema } from '../schemas/modelo-182.schema.js';
import { ficheroDeDatosMiddleware } from '../middleware/upload.middleware.js';
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
  remesaSchema,
  misRecibosQuerySchema,
  updateReciboSchema
} from '../schemas/recibo.schema.js';
import { estadoDePagoSchema, pagarEnLineaSchema } from '../schemas/procesion.schema.js';

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
reciboRoutes.get('/mis-recibos/certificados', Modelo182Controller.misCertificados);
reciboRoutes.get('/mis-recibos/certificados/pdf', validate(certificadosQuerySchema), Modelo182Controller.miCertificado);
reciboRoutes.get('/mis-recibos/:id', validateId, ReciboController.getMyRecibo);

// Pagar en línea recibos de la familia: con Redsys devuelve el formulario
// para ir al banco; simulado, cobra en el acto (ver `modoDePago`).
reciboRoutes.post('/mis-recibos/pagar', validate(pagarEnLineaSchema), ReciboController.pagarEnLinea);

// Cómo va un pago propio, a la vuelta del banco. Filtra por usuario en el servicio.
reciboRoutes.get('/mis-recibos/pagos/:pedido', validate(estadoDePagoSchema), ReciboController.estadoDelPago);

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

// Remesas SEPA: el fichero de adeudos para la banca en línea. Antes de las
// rutas con `/admin/:id`, aunque hoy no chocan por la forma.
// El Modelo 182: los donativos del año para Hacienda, y los certificados.
reciboRoutes.get('/admin/modelo-182', checkRole(rolesTesoreria), validate(ejercicioQuerySchema), Modelo182Controller.resumen);
reciboRoutes.put('/admin/modelo-182/configuracion', checkRole([Role.ADMIN, Role.TESORERIA]), validate(configuracionModelo182Schema), Modelo182Controller.guardarConfiguracion);
reciboRoutes.get('/admin/modelo-182/fichero', checkRole(rolesTesoreria), validate(ficheroModelo182Schema), Modelo182Controller.fichero);
reciboRoutes.get('/admin/modelo-182/certificados', checkRole(rolesTesoreria), validate(certificadosQuerySchema), Modelo182Controller.certificados);
reciboRoutes.post('/admin/modelo-182/enviar', checkRole([Role.ADMIN, Role.TESORERIA]), validate(ejercicioQuerySchema), Modelo182Controller.enviar);

reciboRoutes.get('/admin/remesas', checkRole(rolesTesoreria), RemesaController.estado);
reciboRoutes.post('/admin/remesas/previa', checkRole(rolesTesoreria), validate(remesaSchema), RemesaController.previa);
reciboRoutes.post('/admin/remesas', checkRole(rolesTesoreria), validate(remesaSchema), RemesaController.generar);
reciboRoutes.get('/admin/remesas/:id/fichero', checkRole(rolesTesoreria), validateId, RemesaController.fichero);
reciboRoutes.post('/admin/remesas/:id/cobrar', checkRole(rolesTesoreria), validateId, RemesaController.darPorCobrada);

// El extracto del banco en Norma 43: casa devoluciones y cobros de las remesas.
// El fichero va a memoria y no se guarda: se lee y se descarta.
reciboRoutes.post('/admin/remesas/norma43/previa', checkRole(rolesTesoreria), ficheroDeDatosMiddleware.single('fichero'), Norma43Controller.previa);
reciboRoutes.post('/admin/remesas/norma43/aplicar', checkRole(rolesTesoreria), ficheroDeDatosMiddleware.single('fichero'), Norma43Controller.aplicar);

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
