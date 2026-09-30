import { Router } from 'express';
import { TransaccionController } from '../controllers/transaccion.controller.js';
import { PartidaDobleController } from '../controllers/partida-doble.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { Role } from '@prisma/client';
import { validate } from '../config/validate.js';
import {
  categoriasQuerySchema,
  cuentaCategoriaSchema,
  diarioSchema,
  ejercicioSchema,
  createCategoriaSchema,
  createTransaccionSchema,
  estadoCategoriaSchema,
  libroMayorQuerySchema,
  renombrarCategoriaSchema,
  resumenQuerySchema,
  transaccionIdSchema,
  updateTransaccionSchema,
} from '../schemas/transaccion.schema.js';


const transaccionRoutes = Router();

// Nadie entra sin estar logueado y sin ser del equipo económico. Corregir,
// borrar y gestionar categorías lo pueden los mismos que ya apuntan: el router
// entero va detrás de estos dos middlewares.
transaccionRoutes.use(authenticateToken);
transaccionRoutes.use(checkRole([Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR]));

// Rutas
// --- GESTIÓN DE CATEGORÍAS ---
transaccionRoutes.get('/categorias', validate(categoriasQuerySchema), TransaccionController.getCategorias);
transaccionRoutes.post('/categorias', validate(createCategoriaSchema), TransaccionController.createCategoria);
transaccionRoutes.put('/categorias/:id', validate(renombrarCategoriaSchema), TransaccionController.renombrarCategoria);
// Desactivar o reactivar: la categoría no se borra nunca, sus apuntes siguen en el libro.
transaccionRoutes.patch('/categorias/:id/activa', validate(estadoCategoriaSchema), TransaccionController.cambiarEstadoCategoria);

// --- LIBRO MAYOR ---
// La partida doble: el plan de cuentas, el ejercicio y su Excel. Antes de /:id.
transaccionRoutes.get('/partida-doble/plan', PartidaDobleController.plan);
transaccionRoutes.put('/partida-doble/categorias/:id', validate(cuentaCategoriaSchema), PartidaDobleController.asignarCuenta);
transaccionRoutes.get('/partida-doble/:anio', validate(ejercicioSchema), PartidaDobleController.ejercicio);
transaccionRoutes.get('/partida-doble/:anio/diario', validate(diarioSchema), PartidaDobleController.diario);
transaccionRoutes.get('/partida-doble/:anio/excel', validate(ejercicioSchema), PartidaDobleController.excel);

transaccionRoutes.get('/libro-mayor', validate(libroMayorQuerySchema), TransaccionController.getLibroMayor);
// Totales, serie y reparto por categoría para los mismos filtros que el libro mayor.
transaccionRoutes.get('/resumen', validate(resumenQuerySchema), TransaccionController.getResumen);
transaccionRoutes.get('/balance', TransaccionController.getDashboard);
transaccionRoutes.post('/', validate(createTransaccionSchema), TransaccionController.create);
// Solo apuntes manuales: los que vienen de un recibo se corrigen desde el recibo (409).
transaccionRoutes.put('/:id', validate(updateTransaccionSchema), TransaccionController.update);
transaccionRoutes.delete('/:id', validate(transaccionIdSchema), TransaccionController.remove);

export { transaccionRoutes };
