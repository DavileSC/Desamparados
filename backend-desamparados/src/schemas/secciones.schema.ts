import { type } from 'arktype';
import { problemaDeBloque } from './bloques.schema.js';

/**
 * Una sección guardada: un nombre y los bloques que la forman, validados uno a
 * uno con la misma regla que en una página (`problemaDeBloque`). Una sección
 * que no pudiera ponerse en una página no serviría para nada.
 */
export const crearSeccionSchema = type({
  body: {
    nombre: type('1 <= string <= 80').matching(/^[^<>]*$/).describe('un nombre de hasta 80 caracteres, sin < ni >'),
    bloques: type('unknown[]').atLeastLength(1).atMostLength(20),
  },
}).narrow((datos, ctx) => {
  if (datos.body.nombre.trim() === '') return ctx.reject({ path: ['body', 'nombre'], problem: 'no puede quedar en blanco' });
  for (const [indice, bloque] of datos.body.bloques.entries()) {
    const problema = problemaDeBloque(bloque);
    if (problema) return ctx.reject({ path: ['body', 'bloques', indice, ...problema.path], problem: problema.problem });
  }
  return true;
});
