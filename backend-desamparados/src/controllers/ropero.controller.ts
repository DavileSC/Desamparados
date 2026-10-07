import { manejar } from '../utils/manejar.js';
import { RoperoService } from '../services/ropero.service.js';

/** Lo del ropero que no es una prenda suelta (ver `RoperoService`); las prendas siguen en `InventarioController`. */
export class RoperoController {
  static recuento = manejar('Error contando el ropero', async (_req, res) => {
    res.json(await RoperoService.recuento());
  });

  static buscarHermanos = manejar('Error buscando hermanos', async (req, res) => {
    res.json(await RoperoService.buscarHermanos(String(req.query.q ?? '')));
  });
}
