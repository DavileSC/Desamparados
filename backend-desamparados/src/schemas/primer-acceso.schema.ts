import { type } from 'arktype';
import { idParam, paginacionQuery, password } from '../config/common';

/** El enlace de la invitación: el mismo testigo de 64 hexadecimales que la recuperación. */
const testigo = type('string').matching(/^[a-f0-9]{64}$/i).describe('el enlace de la invitación');

export const ESTADOS_PRIMER_ACCESO = ['sin-invitar', 'invitado', 'confirmado'] as const;

// El testigo va en el cuerpo y no en la ruta, como en la recuperación: una URL
// acaba en los registros de nginx y de la API, y este abre la cuenta dos semanas.
export const datosInvitacionSchema = type({ body: { token: testigo } });

export const estrenarCuentaSchema = type({
  body: { token: testigo, newPassword: password, 'recordarme?': 'boolean' },
});

export const listadoPrimerAccesoSchema = type({
  query: {
    ...paginacionQuery,
    'estado?': type.enumerated(...ESTADOS_PRIMER_ACCESO).describe('sin-invitar, invitado o confirmado'),
    'q?': '0 < string <= 100',
  },
});

// Sin `ids`, todas las que faltan por invitar. Con ellos, solo esas (reenviar).
export const invitarSchema = type({
  body: { 'ids?': type('number.integer > 0').array().atLeastLength(1).atMostLength(500) },
});

export const fichaAjenaSchema = type({ params: { id: idParam } });
