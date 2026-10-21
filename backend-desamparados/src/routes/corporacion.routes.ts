import { Router } from 'express';
import { Role } from '@prisma/client';
import { CorporacionController } from '../controllers/corporacion.controller.js';
import { MarcaController } from '../controllers/marca.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { cachePublica } from '../middleware/cache-publica.js';
import { validate } from '../config/validate.js';
import { asistenteSchema, corporacionSchema, identidadSchema, imagenDeMarcaSchema } from '../schemas/corporacion.schema.js';
import { imagenDeMarcaMiddleware } from '../middleware/upload.middleware.js';

/** Secretaría, sede, redes y privacidad: públicos, los pinta la web para cualquiera. */
const corporacionRouter = Router();
corporacionRouter.get('/', cachePublica, CorporacionController.leer);

/**
 * Sistema → Datos de la corporación: Secretaría lleva el contacto, y
 * Administración lo ve todo. La identidad y la marca, solo Administración: el
 * nombre sale en los textos legales y en cada correo y PDF.
 */
const corporacionCmsRouter = Router();
corporacionCmsRouter.use(authenticateToken);
const soloAdministracion = checkRole([Role.ADMIN]);
corporacionCmsRouter.get('/marca', soloAdministracion, MarcaController.leer);
corporacionCmsRouter.put('/identidad', soloAdministracion, validate(identidadSchema), MarcaController.guardar);
corporacionCmsRouter.put('/marca/:clave', soloAdministracion, validate(imagenDeMarcaSchema), imagenDeMarcaMiddleware.single('imagen'), MarcaController.subir);
corporacionCmsRouter.delete('/marca/:clave', soloAdministracion, validate(imagenDeMarcaSchema), MarcaController.quitar);
corporacionCmsRouter.get('/asistente', soloAdministracion, MarcaController.asistente);
corporacionCmsRouter.put('/asistente', soloAdministracion, validate(asistenteSchema), MarcaController.guardarAsistente);
corporacionCmsRouter.use(checkRole([Role.ADMIN, Role.SECRETARIA]));
corporacionCmsRouter.get('/', CorporacionController.leer);
corporacionCmsRouter.put('/', validate(corporacionSchema), CorporacionController.guardar);

export { corporacionRouter as corporacionRoutes, corporacionCmsRouter as corporacionCmsRoutes };
