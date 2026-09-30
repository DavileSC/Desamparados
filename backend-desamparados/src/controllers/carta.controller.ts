import { manejar } from '../utils/manejar.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { CartasService, type DatosDeCarta } from '../services/cartas/cartas.service.js';
import type { TextoDeCarta } from '../services/cartas/carta-pdf.js';

export class CartaController {
  static listar = manejar('Error leyendo las cartas', async (_req, res) => {
    res.json(await CartasService.listar());
  });

  static crear = manejar('Error guardando la carta', async (req, res) => {
    res.json(await CartasService.crear(req.body as DatosDeCarta, req.user?.id));
  });

  static actualizar = manejar('Error guardando la carta', async (req, res) => {
    res.json(await CartasService.actualizar(Number(req.params.id), req.body as DatosDeCarta));
  });

  static borrar = manejar('Error borrando la carta', async (req, res) => {
    await CartasService.borrar(Number(req.params.id));
    res.json({ message: 'Carta borrada' });
  });

  static recuento = manejar('Error contando los destinatarios', async (req, res) => {
    res.json(await CartasService.recuento(String(req.query.consulta ?? '')));
  });

  static pdf = manejar('Error generando las cartas', async (req, res) => {
    const { consulta, prueba = false, ...texto } = req.body as TextoDeCarta & { consulta: string; prueba?: boolean };
    const pdf = await CartasService.pdf(texto, consulta, prueba, AuditoriaService.metaFromReq(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${prueba ? 'carta-de-prueba' : 'cartas'}.pdf"`);
    // Lleva datos de los hermanos: que no se quede en ninguna caché compartida.
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(pdf);
  });
}
