import { Router } from 'express';
import { Role } from '@prisma/client';
import { PortadaController } from '../controllers/portada.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { guardarImagenesPortadaSchema } from '../schemas/portada.schema.js';

const portadaRoutes = Router();

// Gestión de contenido, como las noticias: los mismos roles que las editan.
const rolesCMS = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

// La portada de la web la lee sin sesión.
portadaRoutes.get('/imagenes', PortadaController.listar);

// Se guarda la lista entera de golpe: sin altas ni bajas sueltas, el orden que
// llega es el orden que se enseña.
portadaRoutes.put(
  '/imagenes',
  authenticateToken,
  checkRole(rolesCMS),
  validate(guardarImagenesPortadaSchema),
  PortadaController.guardar,
);

export { portadaRoutes };
