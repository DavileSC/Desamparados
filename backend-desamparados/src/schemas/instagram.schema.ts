import { type } from 'arktype';
import { idParam } from '../config/common.js';

// El token de larga duración de Instagram: letras, números y poco más, de
// unos 150 a 250 caracteres. Se acota para no mandar a Instagram lo que
// alguien pegue por error (un párrafo, una URL entera).
export const conectarInstagramSchema = type({
  body: {
    token: type('string').pipe((t: string) => t.trim(), type('string').matching(/^[A-Za-z0-9_.|-]{40,1000}$/))
      .describe('el token de Instagram tal como lo da el panel de Meta'),
  },
});

// El tope del pie lo pone problemaDelPie (domain/instagram.ts), con su mensaje;
// aquí solo se corta lo que no puede ser de ningún modo.
export const publicarNoticiaInstagramSchema = type({
  params: { id: idParam },
  body: {
    pie: 'string <= 5000',
    'otraVez?': 'boolean',
  },
});
