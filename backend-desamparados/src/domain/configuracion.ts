/**
 * Reglas de los parámetros de `/admin/config`, clave por clave.
 *
 * Antes se aceptaba cualquier texto: un precio escrito «30€» o «treinta» se
 * guardaba tal cual y `procesion.service.ts` lo convertía con `Number()` en
 * `NaN`, que acababa en el precio de reserva sin que nadie se enterara. Vive
 * suelto, sin base de datos, para que el esquema de la ruta y el servicio usen
 * exactamente la misma regla y se pueda probar sin levantar nada.
 */

export const CLAVES_CONFIGURACION = [
  'precio_papeleta_sitio',
  'precio_alquiler_tunica',
  // Datos de la salida que la mesa de reparto y Tesorería ponen en el correo
  // de la papeleta (los lee procesion.service.ts de esta misma tabla).
  'procesion_fecha',
  'procesion_hora',
  'procesion_acceso',
] as const;

export type ClaveConfiguracion = typeof CLAVES_CONFIGURACION[number];

export const esClaveConfiguracion = (clave: string): clave is ClaveConfiguracion =>
  (CLAVES_CONFIGURACION as readonly string[]).includes(clave);

export type ResultadoValor = { ok: true; valor: string } | { ok: false; error: string };

/**
 * Importe en euros: coma o punto decimal (en España se escribe con coma), como
 * mucho dos decimales y nunca negativo. Es exactamente el formato que acepta la
 * lectura en procesion.service.ts: si aquí se dejara pasar otro, la inscripción
 * en la mesa de reparto se pararía con un 409. Se guarda siempre con punto.
 */
const IMPORTE = /^\d{1,8}(?:[.,]\d{1,2})?$/;

/**
 * Texto libre de la procesión (fecha, hora, punto de acceso): va a un correo,
 * así que sin `<` ni `>` (nada de etiquetas) y sin caracteres de control (un
 * salto de línea no pinta nada en una línea de datos). Obligatorio: un hueco en
 * blanco en el correo de la papeleta es peor que el valor anterior.
 */
const LONGITUD_MAXIMA_TEXTO = 120;
const TEXTO_PROHIBIDO = /[<>\x00-\x1F\x7F]/; // con escapes: un NUL literal hace que git trate el fichero como binario

export function normalizarValorConfiguracion(clave: ClaveConfiguracion, valorCrudo: string): ResultadoValor {
  const valor = valorCrudo.trim();

  switch (clave) {
    case 'precio_papeleta_sitio':
    case 'precio_alquiler_tunica': {
      if (!IMPORTE.test(valor)) {
        return { ok: false, error: 'El precio debe ser un importe en euros mayor o igual que 0, con coma o punto y como mucho dos decimales (por ejemplo, 30 o 12,50).' };
      }
      // Coma a punto y fuera los ceros de relleno por la izquierda («030,5» → «30.5»).
      return { ok: true, valor: valor.replace(',', '.').replace(/^0+(?=\d)/, '') };
    }

    case 'procesion_fecha':
    case 'procesion_hora':
    case 'procesion_acceso': {
      if (valor.length === 0 || valor.length > LONGITUD_MAXIMA_TEXTO || TEXTO_PROHIBIDO.test(valor)) {
        return { ok: false, error: `El texto debe tener entre 1 y ${LONGITUD_MAXIMA_TEXTO} caracteres, sin «<» ni «>».` };
      }
      return { ok: true, valor };
    }
  }
}
