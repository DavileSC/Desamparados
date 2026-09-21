import { Router } from 'express';
import { ContactoController } from '../controllers/contacto.controller.js';
import { validate } from '../config/validate.js';
import { contactoSchema } from '../schemas/contacto.schema.js';
import { limitadorContacto } from '../config/limiter.js';

const contactoRoutes = Router();
contactoRoutes.post('/', limitadorContacto, validate(contactoSchema), ContactoController.send);

export { contactoRoutes };
