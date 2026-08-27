import { Request, Response } from 'express';
import { ContactDto } from '../dtos/contact.dto.js';
import { EmailService } from '../services/email.service.js';
import { HttpError, handleHttp } from '../utils/error.handle.js';

export class ContactController {
  static async send(req: Request, res: Response) {
    try {
      const sent = await EmailService.enviarContacto(req.body as ContactDto);
      if (!sent) throw new HttpError('No se ha podido enviar el mensaje. Inténtalo de nuevo más tarde.', 503);
      res.status(200).json({ message: 'Mensaje enviado correctamente.' });
    } catch (error) {
      handleHttp(res, error, 'No se ha podido enviar el mensaje. Inténtalo de nuevo más tarde.');
    }
  }
}
