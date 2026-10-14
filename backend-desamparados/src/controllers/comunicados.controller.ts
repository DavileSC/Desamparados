import { manejar } from '../utils/manejar.js';
import { resumenDeEnvios } from '../services/correos/cola.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { ComunicadosService, type DatosComunicado } from '../services/comunicados.service.js';

const id = (req: { params: { id?: string } }) => Number(req.params.id);

export class ComunicadosController {
  static listar = manejar('Error obteniendo los comunicados', async (_req, res) => {
    res.json(await ComunicadosService.listar());
  });

  static envios = manejar('No se han podido cargar los envíos', async (_req, res) => {
    res.json(await resumenDeEnvios());
  });

  static obtener = manejar('Error obteniendo el comunicado', async (req, res) => {
    res.json(await ComunicadosService.obtener(id(req)));
  });

  static destinatarios = manejar('Error contando los destinatarios', async (req, res) => {
    const { tipo, segmento } = req.body as Pick<DatosComunicado, 'tipo' | 'segmento'>;
    res.json(await ComunicadosService.destinatarios(tipo, segmento));
  });

  static crear = manejar('Error guardando el comunicado', async (req, res) => {
    res.status(201).json(await ComunicadosService.crear(req.body as DatosComunicado, AuditoriaService.metaFromReq(req)));
  });

  static actualizar = manejar('Error guardando el comunicado', async (req, res) => {
    res.json(await ComunicadosService.actualizar(id(req), req.body as DatosComunicado));
  });

  static borrar = manejar('Error borrando el comunicado', async (req, res) => {
    await ComunicadosService.borrar(id(req));
    res.status(204).end();
  });

  static prueba = manejar('Error enviando la prueba', async (req, res) => {
    res.json(await ComunicadosService.enviarPrueba(id(req), AuditoriaService.metaFromReq(req)));
  });

  static enviar = manejar('Error enviando el comunicado', async (req, res) => {
    res.json(await ComunicadosService.enviar(id(req), AuditoriaService.metaFromReq(req)));
  });

  static reintentar = manejar('Error reintentando los envíos', async (req, res) => {
    res.json(await ComunicadosService.reintentarFallidos(id(req)));
  });

  static bajaBoletin = manejar('Error dando de baja del boletín', async (req, res) => {
    res.json(await ComunicadosService.bajaDelBoletin((req.body as { token: string }).token));
  });
}
