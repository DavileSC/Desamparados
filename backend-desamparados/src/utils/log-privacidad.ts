/**
 * Enmascarado de datos personales en los registros.
 *
 * Los logs escribían la dirección completa de cada hermano cada vez que se le
 * enviaba un correo. Nadie ha decidido cuánto se conservan esos ficheros ni
 * quién los lee, así que el principio de minimización del RGPD pide no
 * meterlos ahí: para diagnosticar un envío basta con reconocer de quién se
 * trata, no con poder escribirle.
 */

/** `hermano@ejemplo.org` → `he•••@ejemplo.org`. */
export function enmascararEmail(email: string): string {
  const arroba = email.lastIndexOf('@');
  if (arroba <= 0) return '•••';

  const usuario = email.slice(0, arroba);
  const dominio = email.slice(arroba);
  const visible = usuario.slice(0, Math.min(2, usuario.length));

  return `${visible}•••${dominio}`;
}

/**
 * Ruta de una petición tal y como debe quedar en el registro de accesos.
 *
 * Sin la consulta: la búsqueda del censo viaja en `?q=` con nombres y DNI, y el
 * enlace de recuperación de contraseña lleva el token en `?token=`. La API
 * recibe ese token en el cuerpo (`POST /api/auth/reset-password/confirmar`),
 * nunca en la ruta, justamente para que no llegue a ningún registro.
 */
export function rutaParaRegistro(url: string): string {
  return url.split('?')[0].split('#')[0];
}

const MAX_MARCOS_PILA = 12;
const MAX_LONGITUD_MENSAJE = 500;

function marcosDePila(stack: string | undefined): string[] {
  if (!stack) return [];
  return stack
    .split('\n')
    .filter((linea) => /^\s+at /.test(linea))
    .slice(0, MAX_MARCOS_PILA)
    .map((linea) => linea.trim());
}

function recortar(texto: string, max = MAX_LONGITUD_MENSAJE): string {
  const enUnaLinea = texto.replace(/\s+/g, ' ').trim();
  return enUnaLinea.length > max ? `${enUnaLinea.slice(0, max)}…` : enUnaLinea;
}

/** Tapa los literales entre comillas: MariaDB cita ahí el valor que chocó. */
function sinLiterales(texto: string): string {
  return texto.replace(/'[^']*'/g, "'…'").replace(/"[^"]*"/g, '"…"');
}

/**
 * Lo que se escribe en el registro cuando una petición acaba en 500.
 *
 * Volcar el error tal cual es cómodo y peligroso: los errores de Prisma llevan
 * en el mensaje la llamada completa con sus argumentos (correo, DNI, nombre...)
 * y el `meta` de los de clave única repite el valor duplicado. Aquí se queda lo
 * que sirve para diagnosticar —tipo, código de Prisma, modelo, restricción,
 * la última línea del mensaje y la pila— y se descarta el resto.
 */
export function describirErrorParaLog(error: unknown): string {
  if (!(error instanceof Error)) {
    if (error === null || error === undefined) return String(error);
    return `(valor lanzado de tipo ${typeof error}) ${recortar(String(error), 200)}`;
  }

  const e = error as Error & { code?: unknown; meta?: Record<string, any> };
  const partes: string[] = [];

  if (e.name.startsWith('PrismaClient')) {
    partes.push(typeof e.code === 'string' ? `${e.name} ${e.code}` : e.name);

    const lineas = e.message.split('\n').map((l) => l.trim()).filter(Boolean);
    // «Invalid `db.user.create()` invocation in ...»: dice qué consulta falló sin sus argumentos.
    const invocacion = lineas.find((l) => /^Invalid `[^`]+` invocation/.test(l));
    if (invocacion) partes.push(invocacion.replace(/\s+in$/, ''));
    // La última línea es el resumen («Argument `password` is missing.», «Unique
    // constraint failed on the constraint: `User_email_key`»...). El código de
    // la llamada, con los valores, queda en medio y no se copia.
    const resumen = lineas[lineas.length - 1];
    if (resumen && resumen !== invocacion) partes.push(recortar(sinLiterales(resumen)));

    const meta = e.meta;
    if (meta && typeof meta === 'object') {
      if (typeof meta.modelName === 'string') partes.push(`modelo=${meta.modelName}`);
      const causa = meta.driverAdapterError?.cause;
      if (causa && typeof causa === 'object') {
        if (typeof causa.kind === 'string') partes.push(`tipo=${causa.kind}`);
        if (causa.originalCode !== undefined) partes.push(`codigoBD=${String(causa.originalCode)}`);
        const restriccion = causa.constraint;
        if (restriccion?.index) partes.push(`restriccion=${String(restriccion.index)}`);
        if (Array.isArray(restriccion?.fields)) partes.push(`campos=${restriccion.fields.join(',')}`);
      }
      if (meta.target !== undefined) {
        partes.push(`campos=${Array.isArray(meta.target) ? meta.target.join(',') : String(meta.target)}`);
      }
    }
  } else if (e.name === 'DriverAdapterError') {
    // El error de MariaDB tal cual lo pasa el adaptador de Prisma: su mensaje
    // es el de la base de datos, que cita entre comillas el valor que chocó.
    partes.push(`${e.name}: ${recortar(sinLiterales(e.message))}`);
    const causa = (e as { cause?: Record<string, unknown> }).cause;
    if (causa && typeof causa === 'object') {
      if (typeof causa.kind === 'string') partes.push(`tipo=${causa.kind}`);
      if (causa.code !== undefined) partes.push(`codigoBD=${String(causa.code)}`);
    }
  } else {
    partes.push(`${e.name}: ${recortar(e.message)}`);
    if (typeof e.code === 'string' || typeof e.code === 'number') partes.push(`code=${e.code}`);
  }

  const pila = marcosDePila(e.stack);
  return pila.length > 0 ? `${partes.join(' | ')}\n    ${pila.join('\n    ')}` : partes.join(' | ');
}
