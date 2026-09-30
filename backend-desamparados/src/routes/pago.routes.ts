import express, { Router } from 'express';
import { validate } from '../config/validate.js';
import { avisoRedsysSchema } from '../schemas/procesion.schema.js';
import { donativoSchema, estadoDeDonativoSchema } from '../schemas/pago.schema.js';
import { limitadorDonativo } from '../config/limiter.js';
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

// Lo que la web pública necesita para ofrecer el donativo: con qué se paga y
// si es de pruebas. Sin sesión: lo ve cualquiera que abra la página.
pagoRoutes.get('/metodos', PagoController.metodos);

// El donativo desde la web pública, sin cuenta. Se comprueba contra el bloque
// «Donativo» de la página desde la que se hace (ver DonativoService).
pagoRoutes.post('/donativo', limitadorDonativo, validate(donativoSchema), PagoController.donar);
pagoRoutes.get('/donativo/:pedido', validate(estadoDeDonativoSchema), PagoController.estadoDelDonativo);

export { pagoRoutes };
