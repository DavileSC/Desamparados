import { manejar } from '../utils/manejar';
import { AvisosHermanosService, MisAvisosService } from '../services/avisos-hermanos.service.js';
import { AvisosPersonalesService } from '../services/avisos-personales.service.js';
import { ModulosService } from '../services/modulos.service.js';

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

  /**
   * Los de la Junta (si están los comunicados) y los personales, juntos y los
   * más recientes primero: para el hermano son todos «sus avisos».
   */
  static listarAvisos = manejar('No se han podido cargar tus avisos', async (req, res) => {
    const userId = req.user!.id;
    const [deLaJunta, personales] = await Promise.all([
      ModulosService.activo('comunicados').then((si) => (si ? MisAvisosService.listar(userId) : [])),
      AvisosPersonalesService.listar(userId),
    ]);
    const todos = [
      ...deLaJunta.map((a) => ({ ...a, tipo: 'junta' as const })),
      ...personales.map((a) => ({ ...a, tipo: 'personal' as const })),
    ].sort((a, b) => (b.enviadoEl ?? '').localeCompare(a.enviadoEl ?? ''));
    res.status(200).json(todos.slice(0, 100));
  });

  static obtenerAvisoPersonal = manejar('No se ha podido cargar el aviso', async (req, res) => {
    res.status(200).json(await AvisosPersonalesService.obtener(req.user!.id, Number(req.params.id)));
  });

  static obtenerAviso = manejar('No se ha podido cargar el aviso', async (req, res) => {
    res.status(200).json(await MisAvisosService.obtener(req.user!.id, Number(req.params.id)));
  });
}
