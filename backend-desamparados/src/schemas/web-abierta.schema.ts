import { type } from 'arktype';
import { esDiaValido, TOPE_MENSAJE_PROXIMAMENTE } from '../domain/web-abierta.js';

// Vacío viaja como `null`: «Próximamente» dice entonces el texto de siempre.
const mensaje = type('string').pipe((v) => v.trim())
  .narrow((v, ctx) => !/[<>]/.test(v) || ctx.mustBe('un texto sin los signos < ni >'))
  .to(`string <= ${TOPE_MENSAJE_PROXIMAMENTE}`).pipe((v) => v || null).or('null');

const fecha = type('string')
  .narrow((v, ctx) => esDiaValido(v) || ctx.mustBe('un día como 2027-03-20'))
  .or('null');

/** Sistema → Abrir la web: los tres campos de una vez, como los manda la pantalla. */
export const estadoDeLaWebSchema = type({ body: { abierta: 'boolean', mensaje, fecha } });
