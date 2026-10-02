import { type } from 'arktype';

export const cambiarModuloSchema = type({
  params: { clave: type('string').matching(/^[a-z0-9]+(-[a-z0-9]+)*$/).describe('la clave de un módulo') },
  body: { activo: 'boolean', 'conRequisitos?': 'boolean' },
});
