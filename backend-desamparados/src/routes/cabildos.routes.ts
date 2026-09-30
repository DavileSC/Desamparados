import { Router } from 'express';
import { type } from 'arktype';
import { Role } from '@prisma/client';
import { CabildosController } from '../controllers/cabildos.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import {
  actaSchema, asistenteSchema, borrarVotacionSchema, cabildoSchema, celebrarSchema, libroSchema, quitarAsistenteSchema, votacionSchema,
} from '../schemas/cabildos.schema.js';

const cabildosRoutes = Router();
cabildosRoutes.use(authenticateToken);

// Los cabildos los lleva Secretaría, con la administración y el Hermano Mayor,
// que los preside. Todas las rutas son de gestión: el rol se exige una vez.
cabildosRoutes.use(checkRole([Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR]));
const validateId = validate(type({ params: { id: idParam } }));

cabildosRoutes.get('/', CabildosController.listar);
cabildosRoutes.post('/', validate(cabildoSchema), CabildosController.crear);
// El libro, antes de `/:id` para que «libro» no se lea como un id.
cabildosRoutes.get('/libro/:anio', validate(libroSchema), CabildosController.libro);
cabildosRoutes.get('/:id', validateId, CabildosController.obtener);
cabildosRoutes.put('/:id', validateId, validate(cabildoSchema), CabildosController.actualizar);
cabildosRoutes.delete('/:id', validateId, CabildosController.borrar);
cabildosRoutes.post('/:id/convocatoria', validateId, CabildosController.convocatoria);
cabildosRoutes.post('/:id/asistentes', validate(asistenteSchema), CabildosController.anadirAsistente);
cabildosRoutes.delete('/:id/asistentes/:hermanoId', validate(quitarAsistenteSchema), CabildosController.quitarAsistente);
cabildosRoutes.post('/:id/votaciones', validate(votacionSchema), CabildosController.anadirVotacion);
cabildosRoutes.delete('/:id/votaciones/:votacionId', validate(borrarVotacionSchema), CabildosController.borrarVotacion);
cabildosRoutes.post('/:id/celebrar', validate(celebrarSchema), CabildosController.celebrar);
cabildosRoutes.put('/:id/acta', validate(actaSchema), CabildosController.guardarActa);
cabildosRoutes.post('/:id/acta/aprobar', validateId, CabildosController.aprobarActa);
cabildosRoutes.get('/:id/acta.pdf', validateId, CabildosController.actaPdf);

export { cabildosRoutes };
