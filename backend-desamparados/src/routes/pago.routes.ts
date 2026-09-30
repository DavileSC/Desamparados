import express, { Router } from 'express';
import { validate } from '../config/validate.js';
import { avisoRedsysSchema } from '../schemas/procesion.schema.js';
import { PagoController } from '../controllers/pago.controller.js';

const pagoRoutes = Router();

// El aviso del banco: sin sesión (lo manda Redsys, no el hermano) y en
// formulario, no en JSON; por eso trae su propio lector, pequeño. Lo que lo
// protege es la firma, que comprueba el servicio antes de tocar nada.
pagoRoutes.post('/redsys/notificacion',
  express.urlencoded({ extended: false, limit: '16kb' }),
  validate(avisoRedsysSchema),
  PagoController.avisoRedsys,
);

export { pagoRoutes };
