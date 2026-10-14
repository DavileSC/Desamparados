import { type } from 'arktype';
import { idParam, textoRequerido } from '../config/common';
import { esEndpointDePush } from '../domain/push';

/** Lo que manda el navegador al activar los avisos: su suscripción y el nombre que se pone solo. */
export const apuntarMovilDeAvisosSchema = type({
  body: {
    nombre: textoRequerido.and('string <= 60'),
    suscripcion: {
      endpoint: type('string <= 1000').narrow((url, ctx) => esEndpointDePush(url) || ctx.reject({ problem: 'no es de un servicio de avisos conocido' })),
      'expirationTime?': 'number | null',
      keys: {
        p256dh: type('string').matching(/^[A-Za-z0-9_-]{40,200}={0,2}$/),
        auth: type('string').matching(/^[A-Za-z0-9_-]{16,100}={0,2}$/),
      },
    },
  },
});

export const conIdSchema = type({ params: { id: idParam } });
