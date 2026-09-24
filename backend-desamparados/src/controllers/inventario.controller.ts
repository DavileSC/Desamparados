import { InventarioService } from '../services/inventario.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';
import { cambiarTotalDeCingulos, recuentoDeCingulos } from '../services/procesion/cingulos.js';

export class InventarioController {

  // =================================================================
  //  BLOQUE 1: ENSERES (Albacería - Lotes)
  // =================================================================

  static listEnseres = manejar('Error listando los enseres', async (req, res) => {
    // req.query viene limpio por ArkType (ej. search, categoria)
    const result = await InventarioService.getAllEnseres(req.query as any); 
    res.status(200).json(result);
  });

  static opcionesEnseres = manejar('Error obteniendo las categorías y ubicaciones', async (_req, res) => {
    res.status(200).json(await InventarioService.opcionesEnseres());
  });

  static getOneEnser = manejar('Error obteniendo ficha del enser', async (req, res) => {
    const id = Number(req.params.id);
    const enser = await InventarioService.getEnserById(id);
    res.status(200).json(enser);
  });

  static createEnser = manejar('Error creando registro de enser', async (req, res) => {
    const newItem = await InventarioService.createEnser(req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.ENSER_CREAR, AuditoriaService.metaFromReq(req), 'enser', newItem.id);
    res.status(201).json(newItem);
  });

  static updateEnser = manejar('Error actualizando enser', async (req, res) => {
    const id = Number(req.params.id);
    const updated = await InventarioService.updateEnser(id, req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.ENSER_ACTUALIZAR, AuditoriaService.metaFromReq(req), 'enser', id);
    res.status(200).json(updated);
  });

  static deleteEnser = manejar('Error eliminando enser', async (req, res) => {
    const id = Number(req.params.id);
    await InventarioService.deleteEnser(id);
    AuditoriaService.log(ACCIONES_AUDITORIA.ENSER_ELIMINAR, AuditoriaService.metaFromReq(req), 'enser', id);
    res.status(200).json({ message: 'Enser eliminado del inventario' });
  });

  // =================================================================
  //  BLOQUE 2: ROPERO (Túnicas, Capirotes, Faraonas)
  // =================================================================

  static listPrendas = manejar('Error listando el ropero', async (req, res) => {
    const result = await InventarioService.getAllPrendas(req.query as any);
    res.status(200).json(result);
  });

  static getOnePrenda = manejar('Error obteniendo ficha de la prenda', async (req, res) => {
    const id = Number(req.params.id);
    const prenda = await InventarioService.getPrendaById(id);
    res.status(200).json(prenda);
  });

  static createPrenda = manejar('Error registrando nueva prenda', async (req, res) => {
    const newItem = await InventarioService.createPrenda(req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.PRENDA_CREAR, AuditoriaService.metaFromReq(req), 'prenda', newItem.id);
    res.status(201).json(newItem);
  });

  static updatePrenda = manejar('Error actualizando datos de la prenda', async (req, res) => {
    const id = Number(req.params.id);
    const updated = await InventarioService.updatePrenda(id, req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.PRENDA_ACTUALIZAR, AuditoriaService.metaFromReq(req), 'prenda', id);
    res.status(200).json(updated);
  });

  static deletePrenda = manejar('Error eliminando prenda', async (req, res) => {
    const id = Number(req.params.id);
    await InventarioService.deletePrenda(id);
    AuditoriaService.log(ACCIONES_AUDITORIA.PRENDA_ELIMINAR, AuditoriaService.metaFromReq(req), 'prenda', id);
    res.status(200).json({ message: 'Prenda eliminada del ropero' });
  });

  // --- LÓGICA DE ASIGNACIONES (PRÉSTAMOS Y DEVOLUCIONES) ---

  static buscarHermano = manejar('Error buscando al hermano', async (req, res) => {
    const hermano = await InventarioService.buscarHermanoPorNumero(Number(req.params.numeroHermano));
    res.status(200).json(hermano);
  });

  static asignarPrenda = manejar('Error al asignar la prenda al hermano', async (req, res) => {
    const prendaId = Number(req.params.id);
    // El body trae { numeroHermano: 123 } validado por ArkType (inventario.schema.ts)
    const { numeroHermano } = req.body;

    const result = await InventarioService.asignarPrenda(prendaId, numeroHermano);
    AuditoriaService.log(ACCIONES_AUDITORIA.PRENDA_ASIGNAR, AuditoriaService.metaFromReq(req), 'prenda', prendaId, { numeroHermano });
    res.status(200).json({ message: 'Prenda asignada correctamente', data: result });
  });

  static devolverPrenda = manejar('Error al procesar la devolución de la prenda', async (req, res) => {
    const prendaId = Number(req.params.id);
    const rota = req.body.rota === true;
    const result = await InventarioService.devolverPrenda(prendaId, rota);
    AuditoriaService.log(ACCIONES_AUDITORIA.PRENDA_DEVOLVER, AuditoriaService.metaFromReq(req), 'prenda', prendaId, { rota, estado: result.estado });
    res.status(200).json({ message: 'Prenda devuelta con éxito', data: result });
  });

  static prendasLavadas = manejar('Error marcando las prendas como lavadas', async (req, res) => {
    const resultado = await InventarioService.marcarLavadas(req.body.ids as number[] | undefined);
    AuditoriaService.log(ACCIONES_AUDITORIA.PRENDAS_LAVADAS, AuditoriaService.metaFromReq(req), 'prenda', resultado.ids.join(','), { despues: resultado });
    res.json(resultado);
  });

  static cingulos = manejar('Error contando los cíngulos', async (_req, res) => {
    res.json(await recuentoDeCingulos());
  });

  static cambiarCingulos = manejar('Error cambiando el total de cíngulos', async (req, res) => {
    const { antes, despues } = await cambiarTotalDeCingulos(req.body.total as number);
    AuditoriaService.log(ACCIONES_AUDITORIA.CINGULOS_TOTAL, AuditoriaService.metaFromReq(req), 'configuracion', 'cingulos_total', { antes: { total: antes }, despues: { total: despues.total } });
    res.json(despues);
  });

  // =================================================================
  //  BLOQUE 3: DASHBOARD (Resumen Global)
  // =================================================================

  static dashboard = manejar('Error obteniendo resumen del inventario', async (_req, res) => {
    // Ahora trae tanto los datos de Albacería como de Ropero
    const resumen = await InventarioService.getResumenInventario();
    res.status(200).json(resumen);
  });
}
