import type { Sede } from '../../../../../shared/datos-entidad.mjs'

/**
 * A dónde se va a formalizar el alta: «Secretaría (Iglesia Parroquial de San
 * Juan, Plaza Mayor, 1)». Antes decía «la casa parroquial», que solo vale para
 * una corporación con sede en una parroquia; la sede sale de los datos de
 * contacto, que cada instalación edita en el CMS. Entre paréntesis y no «en
 * la …» porque el nombre de la sede no trae artículo y no se le puede poner uno
 * a ciegas («en Casa Hermandad», «en la Iglesia…»). Sin sede (o mientras llega),
 * solo «Secretaría»: la frase sigue entera.
 */
export function secretariaEnLaSede(sede: Sede | null | undefined): string {
  const donde = [sede?.nombre, sede?.calle].map((t) => t?.trim()).filter(Boolean).join(', ')
  return donde ? `Secretaría (${donde})` : 'Secretaría'
}
