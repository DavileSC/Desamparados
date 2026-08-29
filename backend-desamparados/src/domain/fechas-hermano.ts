import { HttpError } from '../utils/error.handle';

/**
 * Reglas de las dos fechas de la ficha.
 *
 * Vive aquí y no en el formulario porque el CMS no es el único que puede llamar
 * al endpoint: una regla que solo existe en la pantalla no es una regla.
 */
export function comprobarFechasHermano(
  fechaAlta: Date | null | undefined,
  fechaBaja: Date | null | undefined,
): { activo?: boolean } {
  if (fechaAlta && fechaBaja && fechaBaja < fechaAlta) {
    throw new HttpError('La fecha de baja no puede ser anterior a la de alta.');
  }
  // Quitar la baja es la forma natural de decir «este hermano sigue con nosotros».
  if (fechaBaja === null) return { activo: true };
  return {};
}
