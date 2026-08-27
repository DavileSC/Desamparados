import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller.js';
import { validate } from '../config/validate.js';
import { contactSchema } from '../schemas/contact.schema.js';
import { contactLimiter } from '../config/limiter.js';

const contactRoutes = Router();
contactRoutes.post('/', contactLimiter, validate(contactSchema), ContactController.send);

export { contactRoutes };
