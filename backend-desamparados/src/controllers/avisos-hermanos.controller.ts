import { manejar } from '../utils/manejar';
import { AvisosHermanosService, MisAvisosService } from '../services/avisos-hermanos.service.js';

export class AvisosHermanosController {
  static listarMoviles = manejar('No se han podido cargar tus móviles', async (req, res) => {
    res.status(200).json(await AvisosHermanosService.listar(req.user!.id));
  });

  static apuntarMovil = manejar('No se han podido activar los avisos', async (req, res) => {
    const { nombre, suscripcion } = req.body as { nombre: string; suscripcion: { endpoint: string; keys: { p256dh: string; auth: string } } };
    const movil = await AvisosHermanosService.apuntar(req.user!.id, {
      nombre, suscripcion: { endpoint: suscripcion.endpoint, p256dh: suscripcion.keys.p256dh, auth: suscripcion.keys.auth },
    });
    res.status(201).json(movil);
  });

  static quitarMovil = manejar('No se han podido quitar los avisos de ese móvil', async (req, res) => {
    await AvisosHermanosService.quitar(req.user!.id, Number(req.params.id));
    res.status(204).end();
  });

  static listarAvisos = manejar('No se han podido cargar tus avisos', async (req, res) => {
    res.status(200).json(await MisAvisosService.listar(req.user!.id));
  });

  static obtenerAviso = manejar('No se ha podido cargar el aviso', async (req, res) => {
    res.status(200).json(await MisAvisosService.obtener(req.user!.id, Number(req.params.id)));
  });
}
