import { Router } from 'express';
import { Role } from '@prisma/client';
import { ApadrinamientosController as C } from '../controllers/apadrinamientos.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { limitadorCompras } from '../config/limiter.js';
import { apadrinarSchema, campanaIdSchema, campanaSchema, piezaIdSchema, piezaSchema, tokenApadrinamientoSchema } from '../schemas/apadrinamientos.schema.js';

const apadrinamientosRoutes = Router();

// Lo público, ANTES de la sesión: ver las campañas, apadrinar sin cuenta y
// ver el propio apadrinamiento con su enlace. Apadrinar va con el limitador de
// las compras de la tienda: apunta un pago y manda un correo.
apadrinamientosRoutes.get('/', C.campanasPublicas);
apadrinamientosRoutes.get('/campanas/:id', validate(campanaIdSchema), C.campanaPublica);
apadrinamientosRoutes.post('/', limitadorCompras, validate(apadrinarSchema), C.apadrinar);
apadrinamientosRoutes.get('/gracias/:token', validate(tokenApadrinamientoSchema), C.apadrinamiento);

// La gestión: campañas y piezas, desde el CMS.
const admin = Router();
admin.use(authenticateToken);
admin.use(checkRole([Role.ADMIN, Role.ALBACERIA, Role.TESORERIA, Role.HERMANO_MAYOR]));
admin.get('/campanas', C.campanas);
admin.post('/campanas', validate(campanaSchema), C.crearCampana);
admin.get('/campanas/:id', validate(campanaIdSchema), C.campana);
admin.put('/campanas/:id', validate(campanaIdSchema), validate(campanaSchema), C.actualizarCampana);
admin.post('/campanas/:id/piezas', validate(campanaIdSchema), validate(piezaSchema), C.ponerPieza);
admin.put('/campanas/:id/piezas/:piezaId', validate(piezaIdSchema), validate(piezaSchema), C.cambiarPieza);
admin.delete('/campanas/:id/piezas/:piezaId', validate(piezaIdSchema), C.quitarPieza);
apadrinamientosRoutes.use('/admin', admin);

export { apadrinamientosRoutes };
