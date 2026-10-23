import type { ArkError } from 'arktype';

/**
 * Traduce un problema de ArkType a un mensaje en español para el formulario.
 *
 * ArkType redacta en inglés y antepone la ruta («body.importe must be positive
 * (was -1)»); el antiguo `replace(/^Must be/…)` nunca casaba porque el mensaje
 * empieza por la ruta, así que al CMS llegaba el inglés tal cual. Aquí se usa
 * `expected`, que es la descripción del tipo sin ruta ni valor recibido: los
 * tipos con `.describe()` ya vienen en español («un email válido») y los
 * predefinidos se traducen con esta tabla. Lo que no se reconoce se deja como
 * venga: mejor un término técnico que un mensaje inventado.
 */
const EXPRESIONES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^a string$/, () => 'un texto'],
  [/^a number$/, () => 'un número'],
  [/^an integer$/, () => 'un número entero'],
  [/^boolean$|^a boolean$/, () => 'verdadero o falso'],
  [/^an object$/, () => 'un objeto'],
  [/^an array$/, () => 'una lista'],
  [/^positive$/, () => 'mayor que cero'],
  [/^negative$/, () => 'menor que cero'],
  [/^non-negative$/, () => 'cero o más'],
  [/^at least length (\d+)$/, (m) => `de al menos ${m[1]} caracteres`],
  [/^at most length (\d+)$/, (m) => `de ${m[1]} caracteres como mucho`],
  [/^exactly length (\d+)$/, (m) => `de exactamente ${m[1]} caracteres`],
  [/^non-empty$/, () => 'no vacío'],
  [/^at least (\S+)$/, (m) => `${m[1]} o más`],
  [/^at most (\S+)$/, (m) => `${m[1]} o menos`],
  [/^more than (\S+)$/, (m) => `mayor que ${m[1]}`],
  [/^less than (\S+)$/, (m) => `menor que ${m[1]}`],
  // Un `.narrow()` sin `.describe()` ni motivo propio.
  [/^valid according to an anonymous predicate$/, () => 'un valor válido'],
];

function traducirEsperado(esperado: string): string {
  for (const [patron, traducir] of EXPRESIONES) {
    const m = esperado.match(patron);
    if (m) return traducir(m);
  }
  // Uniones: ArkType mete el mensaje entero en `expected`
  // («body.estado must be "PAGADO" or "PENDIENTE" (was "X")»).
  const union = esperado.match(/must be (.+?)(?: \(was .*\))?$/);
  if (union) return union[1].split(' or ').map(traducirEsperado).join(' o ');
  return esperado;
}

/** Lee una propiedad de ArkType que puede lanzar (son getters perezosos). */
function leer(obtener: () => string | undefined): string | undefined {
  try {
    return obtener();
  } catch {
    return undefined;
  }
}

export function mensajeValidacion(problema: Pick<ArkError, 'code' | 'expected' | 'problem'>): string {
  if (problema.code === 'required') return 'Es obligatorio';
  // En un predicado rechazado con `ctx.reject({ problem })` (la contraseña
  // débil, por ejemplo) el texto propio, ya en español, está en `problem`. Va
  // antes que `expected`: hasta arktype 2.1 leerlo lanzaba, y desde la 2.2 trae
  // «valid according to an anonymous predicate», que taparía el motivo.
  const propio = leer(() => problema.problem);
  const conMotivo = propio && !/^must\b/.test(propio) ? propio.charAt(0).toUpperCase() + propio.slice(1) : undefined;
  if (problema.code === 'predicate' && conMotivo) return conMotivo;
  const esperado = leer(() => problema.expected);
  if (esperado) return `Debe ser ${traducirEsperado(esperado)}`;
  return conMotivo ?? 'No tiene un valor válido';
}
