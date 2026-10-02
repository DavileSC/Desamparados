import express, { Router } from 'express';
import { validate } from '../config/validate.js';
import { avisoRedsysSchema } from '../schemas/procesion.schema.js';
import { donativoSchema, estadoDeDonativoSchema } from '../schemas/pago.schema.js';
import { limitadorDonativo } from '../config/limiter.js';
import { conModulo } from '../middleware/modulos.js';
import { PagoController } from '../controllers/pago.controller.js';

const pagoRoutes = Router();

// Sin guarda a propósito: un pago empezado antes de apagar Pago en línea es
// dinero real y el banco avisa una sola vez.
// El aviso del banco: sin sesión (lo manda Redsys, no el hermano) y en
// formulario, no en JSON; por eso trae su propio lector, pequeño. Lo que lo
// protege es la firma, que comprueba el servicio antes de tocar nada.
pagoRoutes.post('/redsys/notificacion',
  express.urlencoded({ extended: false, limit: '16kb' }),
  validate(avisoRedsysSchema),
  PagoController.avisoRedsys,
);

// Lo que la web pública necesita para ofrecer un pago: solo con la pasarela encendida.
pagoRoutes.get('/metodos', conModulo('pago-en-linea'), PagoController.metodos);

// El donativo desde la web pública, sin cuenta: su propio módulo (que requiere la pasarela).
pagoRoutes.post('/donativo', conModulo('donativos'), limitadorDonativo, validate(donativoSchema), PagoController.donar);
pagoRoutes.get('/donativo/:pedido', conModulo('donativos'), validate(estadoDeDonativoSchema), PagoController.estadoDelDonativo);

export { pagoRoutes };
