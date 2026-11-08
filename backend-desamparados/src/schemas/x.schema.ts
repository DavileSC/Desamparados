import { type } from 'arktype';
import { idParam } from '../config/common.js';

// Las cuatro claves de la app de X tal como las da console.x.com. Se acotan
// para no mandar a X lo que alguien pegue por error (un párrafo, una URL) y
// para que una clave pegada en el sitio de otra se note aquí: el Access Token
// es el único que lleva el id de la cuenta y un guion delante.
const clave = (descripcion: string) =>
  type('string').pipe((t: string) => t.trim(), type('string').matching(/^[A-Za-z0-9_-]{10,200}$/)).describe(descripcion);

export const conectarXSchema = type({
  body: {
    apiKey: clave('la API Key de la app de X'),
    apiSecret: clave('la API Key Secret de la app de X'),
    accessToken: type('string').pipe((t: string) => t.trim(), type('string').matching(/^\d+-[A-Za-z0-9]{10,200}$/))
      .describe('el Access Token de X, que empieza por números y un guion'),
    accessSecret: clave('el Access Token Secret de X'),
  },
});

// El tope del texto lo pone problemaDelTextoX (domain/x.ts), con su mensaje;
// aquí solo se corta lo que no puede ser de ningún modo.
export const publicarNoticiaXSchema = type({
  params: { id: idParam },
  body: {
    texto: 'string <= 2000',
    conFoto: 'boolean',
    'otraVez?': 'boolean',
  },
});
