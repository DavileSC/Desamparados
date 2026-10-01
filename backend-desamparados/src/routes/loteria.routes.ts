import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import {
  compraSchema, entregaSchema, liquidacionSchema, nuevosTalonariosSchema, premiosSchema, sorteoIdSchema, sorteoSchema, tramoSchema,
} from '../schemas/loteria.schema.js';
import { LoteriaController } from '../controllers/loteria.controller.js';

const loteriaRoutes = Router();

// La lotería mueve dinero y lo apunta: Tesorería, y Secretaría, que es donde
// se reparten y se devuelven los talonarios.
loteriaRoutes.use(authenticateToken, checkRole([Role.ADMIN, Role.TESORERIA, Role.SECRETARIA, Role.HERMANO_MAYOR]));

const conId = validate(sorteoIdSchema);

loteriaRoutes.get('/', LoteriaController.sorteos);
loteriaRoutes.post('/', validate(sorteoSchema), LoteriaController.crear);
// Los de un talonario, antes que los de /:id para que «talonarios» no se lea como un id.
loteriaRoutes.delete('/talonarios/:id', conId, LoteriaController.borrarTalonario);
loteriaRoutes.post('/talonarios/:id/liquidacion', conId, validate(liquidacionSchema), LoteriaController.liquidar);
loteriaRoutes.delete('/talonarios/:id/liquidacion', conId, LoteriaController.deshacerLiquidacion);
loteriaRoutes.get('/:id', conId, LoteriaController.sorteo);
loteriaRoutes.put('/:id', conId, validate(sorteoSchema), LoteriaController.actualizar);
loteriaRoutes.delete('/:id', conId, LoteriaController.borrar);
loteriaRoutes.put('/:id/premios', conId, validate(premiosSchema), LoteriaController.premios);
loteriaRoutes.post('/:id/compra', conId, validate(compraSchema), LoteriaController.apuntarCompra);
loteriaRoutes.delete('/:id/compra', conId, LoteriaController.deshacerCompra);
loteriaRoutes.post('/:id/talonarios', conId, validate(nuevosTalonariosSchema), LoteriaController.crearTalonarios);
loteriaRoutes.post('/:id/entregas', conId, validate(entregaSchema), LoteriaController.entregar);
loteriaRoutes.post('/:id/participaciones', conId, validate(tramoSchema), LoteriaController.pdf);

export { loteriaRoutes };
