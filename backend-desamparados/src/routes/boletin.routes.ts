import { Router } from 'express';
import { ComunicadosController } from '../controllers/comunicados.controller.js';
import { validate } from '../config/validate.js';
import { limitadorContacto } from '../config/limiter.js';
import { bajaBoletinSchema } from '../schemas/comunicados.schema.js';

/**
 * La baja del boletín desde el enlace del correo, fuera del módulo «Boletín y
 * avisos». Un boletín ya enviado sigue en los buzones aunque se apague el
 * módulo: con la baja colgando de él, el enlace respondía 404, la suscripción
 * seguía viva y, al volver a encenderlo, esa persona recibía el siguiente.
 * Es el mismo caso que el aviso del banco, que tampoco se apaga.
 *
 * `POST /api/boletin/baja`, sin sesión: se pulsa desde el correo y no se
 * puede pedir entrar para dejar de recibirlo. Cuerpo `{ token }` (el del
 * enlace, firmado en `domain/comunicados.ts`); 200 `{ message }`, 400 si el
 * enlace no vale. La protege esa firma y el limitador del formulario de
 * contacto, el otro público que escribe.
 */
const boletinRoutes = Router();

boletinRoutes.post('/baja', limitadorContacto, validate(bajaBoletinSchema), ComunicadosController.bajaBoletin);

export { boletinRoutes };
