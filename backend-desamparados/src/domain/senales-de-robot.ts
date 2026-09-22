/**
 * Cómo se reconoce a un robot en los formularios públicos.
 *
 * Vive aparte de los controladores porque lo usan dos: el de contacto y el del
 * alta de hermanos. Son los dos únicos formularios que cualquiera puede enviar
 * sin tener cuenta.
 */

/** Menos que esto entre abrir el formulario y enviarlo no lo hace una persona. */
export const MIN_MS_RELLENO = 3000;

/**
 * El campo trampa está escondido en la web: si llega relleno, lo ha escrito un
 * programa que rellena todo lo que encuentra.
 *
 * Su nombre no es de los que autocompletan navegadores y gestores de
 * contraseñas (nada de «web», «url», «nombre»…), para que no lo rellene ninguno
 * por una persona.
 *
 * Es la señal **segura**: nadie que use la web puede rellenarlo sin querer.
 */
export function trampaRellena(comentarioAdicional: string | undefined): boolean {
  return comentarioAdicional !== undefined && comentarioAdicional.trim() !== '';
}

/**
 * Por qué un envío parece de un robot, o null si parece de una persona.
 *
 * - El tiempo de relleno lo mide el navegador de principio a fin (no se manda
 *   la hora de apertura para restarla aquí: con el reloj del ordenador del
 *   visitante adelantado un minuto, una persona real saldría como robot).
 * - Si falta el tiempo, NO se descarta: durante un despliegue, quien tenga
 *   abierta la versión anterior de la web lo envía sin él, y su mensaje se
 *   perdería sin que nadie lo supiera. Se deja constancia en el log.
 */
export function motivoDescarte(
  { comentarioAdicional, tiempoRelleno }: { comentarioAdicional?: string; tiempoRelleno?: number },
): string | null {
  if (trampaRellena(comentarioAdicional)) return 'campo trampa relleno';
  if (tiempoRelleno !== undefined && tiempoRelleno < MIN_MS_RELLENO) return `rellenado en ${Math.round(tiempoRelleno)} ms`;
  return null;
}
