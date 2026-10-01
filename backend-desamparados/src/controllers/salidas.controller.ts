import { manejar } from '../utils/manejar.js';
import { SalidasService } from '../services/procesion/salidas.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import type { DatosSalida } from '../dtos/procesion.dto.js';

/**
 * Las salidas procesionales: el CMS las da de alta, las edita y les fija la
 * fecha a mano (crea o mueve su acto en la Agenda); la web pública y el área
 * de hermanos solo leen las activas (`listarWeb`). El `id` de la ruta llega
 * ya comprobado por `idParam` (`salidas.routes.ts`): aquí solo `Number(...)`.
 */
export class SalidasController {
  static listarWeb = manejar('Error obteniendo las salidas', async (_req, res) => {
    const salidas = await SalidasService.listar();
    res.json(salidas.map((s) => SalidasService.paraLaWeb(s)));
  });

  static listarCms = manejar('Error obteniendo las salidas', async (_req, res) => {
    const salidas = await SalidasService.listar({ todas: true });
    res.json(salidas.map((s) => SalidasService.paraLaWeb(s)));
  });

  static crear = manejar('Error dando de alta la salida', async (req, res) => {
    const salida = await SalidasService.crear(req.body as DatosSalida, AuditoriaService.metaFromReq(req));
    res.status(201).json(SalidasService.paraLaWeb(salida));
  });

  static editar = manejar('Error editando la salida', async (req, res) => {
    const salida = await SalidasService.editar(Number(req.params.id), req.body as Partial<DatosSalida>, AuditoriaService.metaFromReq(req));
    res.json(SalidasService.paraLaWeb(salida));
  });

  static fijarFecha = manejar('Error fijando la fecha de la salida', async (req, res) => {
    const salida = await SalidasService.porId(Number(req.params.id));
    await SalidasService.fijarFecha(salida, req.body as { inicio: string; lugar?: string | null }, AuditoriaService.metaFromReq(req));
    // `fijarFecha` devuelve el acto, no la fila entera: se relee con su acto ya enlazado para la respuesta (`paraLaWeb`).
    res.json(SalidasService.paraLaWeb(await SalidasService.porId(salida.id)));
  });
}
