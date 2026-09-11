/**
 * Supresión de datos personales en los `detalles` de la auditoría (art. 17
 * RGPD, `DELETE /auth/mi-cuenta`).
 *
 * La cuenta se anonimiza, pero los registros de auditoría de sus fichas
 * (HERMANO_ACTUALIZAR, FAMILIAR_ACTUALIZAR, EMANCIPACION...) guardan el antes
 * y el después de cada cambio: DNI, correo y dirección, viejos y nuevos,
 * durante todo el plazo de retención. Suprimir la cuenta dejándolos ahí era
 * suprimirla a medias.
 *
 * Se sustituye el VALOR de los campos personales por «[suprimido]» y se
 * conserva todo lo demás: qué campos cambiaron, cuándo, quién lo hizo, y los
 * valores que no son de la persona (estado, número de hermano, fechas de alta
 * y baja). La auditoría sigue sirviendo para saber qué pasó, sin decir de quién.
 */

export const VALOR_SUPRIMIDO = '[suprimido]';

/** Campos que identifican o describen a la persona (de `User` y de `Hermano`). */
export const CAMPOS_PERSONALES: ReadonlySet<string> = new Set([
  'nombre', 'apellidos', 'dni', 'fechaNacimiento',
  'email', 'telefono', 'direccion', 'poblacion', 'codigoPostal',
  'iban', 'titularCuenta',
  // Tallas y medidas: no identifican solas, pero describen el cuerpo de alguien.
  'tunica', 'alturaHombro',
]);

/**
 * Devuelve una copia de `detalles` con los valores personales suprimidos, a
 * cualquier profundidad (hay registros con listas de fichas dentro). Un campo
 * personal que valía `null` se deja en `null`: ahí no había nada que suprimir
 * y el `null` dice que el dato no existía.
 */
export function suprimirDatosPersonales(detalles: unknown): unknown {
  if (Array.isArray(detalles)) return detalles.map(suprimirDatosPersonales);
  if (detalles === null || typeof detalles !== 'object') return detalles;

  const copia: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(detalles)) {
    copia[clave] = CAMPOS_PERSONALES.has(clave) && valor !== null
      ? VALOR_SUPRIMIDO
      : suprimirDatosPersonales(valor);
  }
  return copia;
}
