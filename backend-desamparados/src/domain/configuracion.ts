/**
 * Reglas de los parámetros de `/admin/config`, clave por clave.
 *
 * Hoy no queda ninguno: la cuota de salida y la fecha, la hora y el acceso de
 * la procesión vivían aquí y ahora son campos de cada `Salida`, que se editan
 * en el CMS. Guardarlos aquí ya no cambiaría nada, y Secretaría vería
 * «guardado» mientras se cobra otra cosa: por eso la ruta responde 400 a
 * cualquier clave en vez de guardarla en silencio.
 *
 * La lista, el tipo y la validación se quedan para el próximo ajuste global:
 * vive suelto, sin base de datos, para que el esquema de la ruta y el servicio
 * usen exactamente la misma regla y se pueda probar sin levantar nada.
 */

export const CLAVES_CONFIGURACION = [] as const satisfies readonly string[];

export type ClaveConfiguracion = typeof CLAVES_CONFIGURACION[number];

export const esClaveConfiguracion = (clave: string): clave is ClaveConfiguracion =>
  (CLAVES_CONFIGURACION as readonly string[]).includes(clave);

type ResultadoValor = { ok: true; valor: string } | { ok: false; error: string };

/** El valor de una clave, ya normalizado. Sin claves permitidas, nunca hay valor que valga. */
export function normalizarValorConfiguracion(clave: ClaveConfiguracion, _valorCrudo: string): ResultadoValor {
  return { ok: false, error: `'${String(clave)}' no es un parámetro de configuración válido.` };
}
