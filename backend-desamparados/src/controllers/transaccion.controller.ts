import { TransaccionService } from '../services/transaccion.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class TransaccionController {

  static create = manejar('Error registrando la transacción', async (req, res) => {
    const transaccion = await TransaccionService.create(req.body, AuditoriaService.metaFromReq(req));
    res.status(201).json({ message: 'Apunte contable registrado', data: transaccion });
  });

  static update = manejar('Error corrigiendo el apunte', async (req, res) => {
    const transaccion = await TransaccionService.update(Number(req.params.id), req.body, AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: 'Apunte corregido', data: transaccion });
  });

  static remove = manejar('Error borrando el apunte', async (req, res) => {
    const borrado = await TransaccionService.remove(Number(req.params.id), AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: 'Apunte borrado', data: borrado });
  });

  static getLibroMayor = manejar('Error obteniendo el libro mayor', async (req, res) => {
    // El saneamiento (defecto, tope) lo decide sanearPaginacion, no el controlador.
    const libro = await TransaccionService.getAll(req.query);
    res.status(200).json(libro);
  });

  static getResumen = manejar('Error calculando el resumen contable', async (req, res) => {
    const resumen = await TransaccionService.getResumen(req.query);
    res.status(200).json(resumen);
  });

  static getCategorias = manejar('Error listando categorías', async (req, res) => {
    // Opcional: ?tipo=INGRESO y ?todas=true. Llegan ya validados por categoriasQuerySchema.
    const tipo = req.query.tipo as 'INGRESO' | 'GASTO' | undefined;
    const categorias = await TransaccionService.getCategorias(tipo, req.query.todas === 'true');
    res.status(200).json(categorias);
  });

  static createCategoria = manejar('Error creando categoría', async (req, res) => {
    const { nombre, tipo } = req.body;
    const nueva = await TransaccionService.createCategoria(nombre, tipo, AuditoriaService.metaFromReq(req));
    res.status(201).json({ message: 'Categoría creada', data: nueva });
  });

  static renombrarCategoria = manejar('Error renombrando la categoría', async (req, res) => {
    const categoria = await TransaccionService.renombrarCategoria(Number(req.params.id), req.body.nombre, AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: 'Categoría renombrada', data: categoria });
  });

  static cambiarEstadoCategoria = manejar('Error cambiando el estado de la categoría', async (req, res) => {
    const activa = req.body.activa as boolean;
    const categoria = await TransaccionService.cambiarEstadoCategoria(Number(req.params.id), activa, AuditoriaService.metaFromReq(req));
    res.status(200).json({ message: activa ? 'Categoría reactivada' : 'Categoría desactivada', data: categoria });
  });
}
