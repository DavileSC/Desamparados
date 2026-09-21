import { ContactFormDto } from '../dtos/contact.dto.js';
import { EmailService } from '../services/email.service.js';
import { HttpError, handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';

/** Menos que esto entre abrir el formulario y enviarlo no lo hace una persona. */
export const MIN_MS_RELLENO = 3000;

/**
 * Por qué un envío parece de un robot, o null si parece de una persona.
 *
 * - El campo trampa (`comentarioAdicional`) está escondido en la web: si llega
 *   relleno, lo ha escrito un programa que rellena todo lo que encuentra. Su
 *   nombre no es de los que autocompletan navegadores y gestores de
 *   contraseñas (nada de «web», «url», «nombre»…), para que no lo rellenen por
 *   una persona.
 * - El tiempo de relleno lo mide el navegador de principio a fin (no se manda
 *   la hora de apertura para restarla aquí: con el reloj del ordenador del
 *   visitante adelantado un minuto, una persona real saldría como robot).
 * - Si falta el tiempo, NO se descarta: durante un despliegue, quien tenga
 *   abierta la versión anterior de la web lo envía sin él, y su mensaje se
 *   perdería sin que nadie lo supiera. Se deja constancia en el log.
 */
export function motivoDescarte({ comentarioAdicional, tiempoRelleno }: Pick<ContactFormDto, 'comentarioAdicional' | 'tiempoRelleno'>): string | null {
  if (comentarioAdicional && comentarioAdicional.trim() !== '') return 'campo trampa relleno';
  if (tiempoRelleno !== undefined && tiempoRelleno < MIN_MS_RELLENO) return `rellenado en ${Math.round(tiempoRelleno)} ms`;
  return null;
}

const MENSAJE_ENVIADO = 'Mensaje enviado correctamente.';

export class ContactController {
  static send = manejar('No se ha podido enviar el mensaje. Inténtalo de nuevo más tarde.', async (req, res) => {
    const { comentarioAdicional, tiempoRelleno, ...datos } = req.body as ContactFormDto;

    // Al robot se le responde lo mismo que a una persona: si notara la
    // diferencia, aprendería a esquivar la trampa. Así tampoco gasta la cuota
    // de envío de la cuenta de correo.
    const motivo = motivoDescarte({ comentarioAdicional, tiempoRelleno });
    if (motivo) {
      console.warn(`[Contacto] Mensaje descartado como spam (${motivo}).`);
      return res.status(200).json({ message: MENSAJE_ENVIADO });
    }
    if (tiempoRelleno === undefined) {
      console.warn('[Contacto] Mensaje sin tiempo de relleno (una versión antigua de la web o una petición directa): se envía igualmente.');
    }

    const sent = await EmailService.enviarContacto(datos);
    if (!sent) throw new HttpError('No se ha podido enviar el mensaje. Inténtalo de nuevo más tarde.', 503);
    res.status(200).json({ message: MENSAJE_ENVIADO });
  });
}
