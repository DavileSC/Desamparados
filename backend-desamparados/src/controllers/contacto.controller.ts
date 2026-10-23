import { FormularioContactoDto } from '../dtos/contacto.dto.js';
import { EmailService } from '../services/email.service.js';
import { HttpError } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import { motivoDescarte } from '../domain/senales-de-robot.js';



const MENSAJE_ENVIADO = 'Mensaje enviado correctamente.';

export class ContactoController {
  static send = manejar('No se ha podido enviar el mensaje. Inténtalo de nuevo más tarde.', async (req, res) => {
    const { comentarioAdicional, tiempoRelleno, ...datos } = req.body as FormularioContactoDto;

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
