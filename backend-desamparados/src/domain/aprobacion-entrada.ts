/**
 * Lo que se puede decidir de una aprobación de entrada sin base ni red: el
 * número que cuadrar y desde dónde se entra.
 */

/** Lo que dura una aprobación: lo que se tarda en sacar el móvil del bolsillo. */
export const APROBACION_SEGUNDOS = 120;

/**
 * El número que enseña el ordenador y los tres que enseña el móvil, uno de
 * ellos el bueno. De dos cifras: fáciles de comparar de un vistazo. Con tres
 * opciones, quien aprueba por costumbre acierta una de cada tres, y fallar
 * anula la aprobación: el número existe para que no baste con tocar «Sí».
 * `azar(n)` devuelve un entero en [0, n), y se puede sustituir para probarlo.
 */
export function numeroYOpciones(azar: (n: number) => number): { numero: number; opciones: number[] } {
  const elegidos: number[] = [];
  while (elegidos.length < 3) {
    const n = 10 + azar(90);
    if (!elegidos.includes(n)) elegidos.push(n);
  }
  const numero = elegidos[0];
  // Fisher-Yates: si el bueno fuera siempre el primero, no haría falta mirar.
  for (let i = elegidos.length - 1; i > 0; i--) {
    const j = azar(i + 1);
    [elegidos[i], elegidos[j]] = [elegidos[j], elegidos[i]];
  }
  return { numero, opciones: elegidos };
}

/** Las opciones como se guardan («12,47,83») y de vuelta. */
export const opcionesATexto = (opciones: number[]): string => opciones.join(',');
export const opcionesDeTexto = (texto: string): number[] => texto.split(',').map(Number);

const SISTEMAS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iPhone'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

// En orden: Edge y Opera dicen también «Chrome», y Chrome dice también «Safari».
const NAVEGADORES: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS/, 'Firefox'],
  [/Chrome\/|CriOS/, 'Chrome'],
  [/Safari\//, 'Safari'],
];

/**
 * «Windows · Chrome»: lo que dice el aviso de dónde viene la entrada. Solo el
 * sistema y el navegador, nada que identifique a nadie: el texto del aviso
 * puede verse en la pantalla bloqueada.
 */
export function describirNavegador(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  const sistema = SISTEMAS.find(([re]) => re.test(ua))?.[1];
  const navegador = NAVEGADORES.find(([re]) => re.test(ua))?.[1];
  if (sistema && navegador) return `${sistema} · ${navegador}`;
  return sistema ?? navegador ?? 'un navegador desconocido';
}

/**
 * Los servicios de push de los navegadores (Chrome y Android, Firefox, Safari
 * e iPhone, Edge). El servidor manda un POST a la URL que da el móvil: sin
 * esta lista, una cuenta del equipo podría apuntar como «móvil» una dirección
 * de la red interna del servidor y hacer que la API la llamara.
 */
const SERVICIOS_DE_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function esEndpointDePush(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.port === '' && !url.username && !url.password
    && SERVICIOS_DE_PUSH.some((re) => re.test(url.hostname));
}
