/**
 * Si la web pública está abierta o enseña «Próximamente». Se cierra para
 * tenerla ya en su dominio antes de presentarla, y otra vez si hay que hacer
 * cambios sin que se vean a medias; la Junta con sesión del CMS la sigue viendo.
 *
 * Vive suelto, sin base de datos, para que el esquema de la ruta y la lectura
 * de la fila usen la misma regla.
 */
// Un `type` y no una `interface`: la auditoría lo guarda como JSON y solo un
// `type` encaja con el índice que pide Prisma.
export type EstadoDeLaWeb = {
  abierta: boolean;
  /** Lo que dice «Próximamente» debajo del nombre; `null`, el texto de siempre de la web. */
  mensaje: string | null;
  /** El día que se presenta (AAAA-MM-DD), si ya se sabe; la portada lo anuncia. */
  fecha: string | null;
};

/** Sin fila, abierta: una instalación que no ha tocado esto sigue como siempre. */
export const WEB_ABIERTA: EstadoDeLaWeb = { abierta: true, mensaje: null, fecha: null };

export const TOPE_MENSAJE_PROXIMAMENTE = 280;

/**
 * Si quien entra por `nombre` ve siempre la web entera, cerrada o no.
 * `lista` es `WEB_SIEMPRE_ABIERTA_EN`, nombres separados por comas: la web de
 * pruebas es el mismo montaje y la misma base que el dominio principal, y con
 * el principal cerrado hasta la presentación se sigue probando en ella (ya
 * pide usuario y contraseña en el nginx). Sin la variable, ninguno.
 */
export function siempreAbiertaEn(nombre: string, lista: string | undefined): boolean {
  if (!lista) return false;
  const buscado = nombre.trim().toLowerCase();
  return lista.split(',').some((n) => n.trim().toLowerCase() === buscado && buscado !== '');
}

export const FECHA_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Que el día exista: «2026-02-30» pasa el patrón, pero no es una fecha. */
export function esDiaValido(dia: string): boolean {
  if (!FECHA_DIA.test(dia)) return false;
  const [a, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/**
 * Lo guardado, tal cual llegue: una fila rota o a medias no cierra la web por
 * sorpresa. Solo cuenta `abierta: false` escrito así.
 */
export function depurarEstado(crudo: unknown): EstadoDeLaWeb {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return WEB_ABIERTA;
  const { abierta, mensaje, fecha } = crudo as Record<string, unknown>;
  const texto = typeof mensaje === 'string' ? mensaje.trim() : '';
  return {
    abierta: abierta !== false,
    mensaje: texto && texto.length <= TOPE_MENSAJE_PROXIMAMENTE ? texto : null,
    fecha: typeof fecha === 'string' && esDiaValido(fecha) ? fecha : null,
  };
}
