import { InventarioService } from '../services/inventario.service.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

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
    AuditService.log(AUDIT_ACTIONS.ENSER_CREAR, AuditService.metaFromReq(req), 'enser', newItem.id);
    res.status(201).json(newItem);
  });

  static updateEnser = manejar('Error actualizando enser', async (req, res) => {
    const id = Number(req.params.id);
    const updated = await InventarioService.updateEnser(id, req.body);
    AuditService.log(AUDIT_ACTIONS.ENSER_ACTUALIZAR, AuditService.metaFromReq(req), 'enser', id);
    res.status(200).json(updated);
  });

  static deleteEnser = manejar('Error eliminando enser', async (req, res) => {
    const id = Number(req.params.id);
    await InventarioService.deleteEnser(id);
    AuditService.log(AUDIT_ACTIONS.ENSER_ELIMINAR, AuditService.metaFromReq(req), 'enser', id);
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
    AuditService.log(AUDIT_ACTIONS.PRENDA_CREAR, AuditService.metaFromReq(req), 'prenda', newItem.id);
    res.status(201).json(newItem);
  });

  static updatePrenda = manejar('Error actualizando datos de la prenda', async (req, res) => {
    const id = Number(req.params.id);
    const updated = await InventarioService.updatePrenda(id, req.body);
    AuditService.log(AUDIT_ACTIONS.PRENDA_ACTUALIZAR, AuditService.metaFromReq(req), 'prenda', id);
    res.status(200).json(updated);
  });

  static deletePrenda = manejar('Error eliminando prenda', async (req, res) => {
    const id = Number(req.params.id);
    await InventarioService.deletePrenda(id);
    AuditService.log(AUDIT_ACTIONS.PRENDA_ELIMINAR, AuditService.metaFromReq(req), 'prenda', id);
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
    AuditService.log(AUDIT_ACTIONS.PRENDA_ASIGNAR, AuditService.metaFromReq(req), 'prenda', prendaId, { numeroHermano });
    res.status(200).json({ message: 'Prenda asignada correctamente', data: result });
  });

  static devolverPrenda = manejar('Error al procesar la devolución de la prenda', async (req, res) => {
    const prendaId = Number(req.params.id);
    // Asumimos que el body trae { necesitaLavado: true/false } (opcional)
    const necesitaLavado = req.body.necesitaLavado === true;

    const result = await InventarioService.devolverPrenda(prendaId, necesitaLavado);
    AuditService.log(AUDIT_ACTIONS.PRENDA_DEVOLVER, AuditService.metaFromReq(req), 'prenda', prendaId, { necesitaLavado });
    res.status(200).json({ message: 'Prenda devuelta con éxito', data: result });
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
