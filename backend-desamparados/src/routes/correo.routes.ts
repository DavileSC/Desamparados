import { Router } from 'express';
import { CorreoController } from '../controllers/correo.controller.js';

/**
 * Los avisos del servicio de envío (Brevo): `POST /api/correo/avisos`, sin
 * sesión, con un evento en JSON (o una lista, si se crea por lotes). Lo
 * protege la clave de CORREO_AVISOS_SECRETO en la cabecera Authorization
 * (`domain/avisos-de-envio.ts`); sin la variable, la ruta no existe (404).
 * Responde 200 aunque el aviso no sirva: con un error, Brevo lo repite.
 * Fuera de cualquier módulo, como el aviso del banco: el correo no se apaga.
 */
const correoRoutes = Router();

correoRoutes.post('/avisos', CorreoController.avisos);

export { correoRoutes };
