import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { describirErrorParaLog, rutaParaRegistro } from './log-privacidad.js';

/**
 * Error de negocio con código HTTP asociado.
 *
 * Los servicios lanzan `HttpError` para reglas de dominio ("Ya tienes tu papeleta",
 * "DNI duplicado", "Hermano no encontrado"...). Su mensaje es apto para el usuario
 * final y viaja al cliente con el estado indicado (por defecto 400).
 *
 * Cualquier otro `Error` (TypeError, fallo de Prisma, bug...) se considera interno:
 * se registra en el servidor y el cliente recibe un 500 genérico sin detalles.
 * La excepción son tres errores de Prisma que sí son culpa de la petición y
 * tienen traducción clara (ver `traducirErrorPrisma`).
 */
export class HttpError extends Error {
  public readonly status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = 'Recurso no encontrado') {
    super(message, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Cómo nombrar ante el usuario los campos con restricción de unicidad del
 * esquema. Con artículo, porque el género cambia: «ese DNI», «esa dirección».
 */
const CAMPOS_UNICOS: Record<string, string> = {
  email: 'ese correo electrónico',
  dni: 'ese DNI',
  numeroHermano: 'ese número de hermano',
  slug: 'esa dirección (slug)',
  numero: 'ese número',
};

/**
 * Campos implicados en un error de clave única. Prisma 7 con el adaptador de
 * MariaDB no rellena `meta.target` sino el nombre del índice
 * (`User_email_key`), del que se sacan los campos quitando el modelo y el
 * sufijo. Se mira también `target` y `fields` por si cambia el adaptador.
 */
function camposDelError(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = (error.meta ?? {}) as Record<string, any>;
  if (Array.isArray(meta.target)) return meta.target.map(String);

  const restriccion = meta.driverAdapterError?.cause?.constraint;
  if (Array.isArray(restriccion?.fields)) return restriccion.fields.map(String);

  const indice = typeof restriccion?.index === 'string'
    ? restriccion.index
    : (typeof meta.target === 'string' ? meta.target : '');
  const modelo = typeof meta.modelName === 'string' ? meta.modelName : '';
  if (!indice) return [];
  let resto = indice.replace(/_key$/, '');
  if (modelo && resto.startsWith(`${modelo}_`)) resto = resto.slice(modelo.length + 1);
  return resto.split('_').filter(Boolean);
}

const CONFLICTO_CONCURRENCIA = {
  status: 409,
  message: 'Otra persona ha cambiado estos datos a la vez; vuelve a intentarlo.',
};

/** Error de MariaDB que trae el adaptador, suelto o envuelto en uno de Prisma. */
function causaDelAdaptador(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { name?: unknown; cause?: unknown; meta?: Record<string, any> };
  if (e.name === 'DriverAdapterError' && e.cause && typeof e.cause === 'object') {
    return e.cause as Record<string, unknown>;
  }
  const envuelta = e.meta?.driverAdapterError?.cause;
  return envuelta && typeof envuelta === 'object' ? envuelta : null;
}

/**
 * Dos transacciones que tocan la misma fila a la vez. La MariaDB de desarrollo
 * (11.8) tiene `innodb_snapshot_isolation=ON` y la segunda falla con el error
 * 1020 («Record has changed since last read»), o con 1213 si es un
 * interbloqueo. El adaptador de Prisma no traduce el 1020 (llega como
 * `DriverAdapterError` con `kind: 'mysql'`), y el 1213 puede llegar así, como
 * `TransactionWriteConflict` o ya convertido en P2034. No es un fallo del
 * servidor: basta con volver a intentarlo.
 */
export function esConflictoDeConcurrencia(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  const causa = causaDelAdaptador(error);
  if (!causa) return false;
  if (causa.kind === 'TransactionWriteConflict') return true;
  const codigo = Number(causa.code ?? causa.originalCode);
  return codigo === 1020 || codigo === 1213;
}

/**
 * Traduce los errores de Prisma (y de su adaptador de MariaDB) que se deben a
 * la petición y no a un fallo del servidor. Antes salían como 500 en toda la
 * API: los controladores capturan el error y llaman a `handleHttp`, que solo
 * reconocía `HttpError`, así que la traducción del manejador global nunca
 * llegaba a ejecutarse.
 *
 *  - P2002 (clave única repetida)  → 409
 *  - P2025 (registro no encontrado) → 404
 *  - P2003 (clave ajena)            → 409: se intenta borrar algo que otros
 *    registros usan, o se enlaza con algo que no existe.
 *  - P2034 y los errores 1020/1213 de MariaDB (escritura concurrente) → 409
 *
 * El valor duplicado NO se repite en el mensaje: el que lo envió ya lo sabe y
 * así no se filtra nada si la respuesta acaba en un registro.
 */
export function traducirErrorPrisma(error: unknown): { status: number; message: string } | null {
  if (esConflictoDeConcurrencia(error)) return { ...CONFLICTO_CONCURRENCIA };
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  switch (error.code) {
    case 'P2002': {
      const campos = camposDelError(error);
      const nombre = campos.length === 1 ? CAMPOS_UNICOS[campos[0]] : undefined;
      return {
        status: 409,
        message: nombre ? `Ya existe un registro con ${nombre}.` : 'Ya existe un registro con ese valor.',
      };
    }
    case 'P2025':
      return { status: 404, message: 'El registro solicitado no existe.' };
    case 'P2003':
      return { status: 409, message: 'No se puede completar: está en uso por otros registros o enlaza con uno que no existe.' };
    default:
      return null;
  }
}

/** « (P2002)» o « (mysql 1020)» para el aviso de un 4xx traducido; vacío si no aplica. */
function codigoParaLog(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return ` (${error.code})`;
  const causa = causaDelAdaptador(error);
  if (causa) return ` (${String(causa.kind ?? 'adaptador')} ${String(causa.code ?? causa.originalCode ?? '')})`.replace(/ \)$/, ')');
  return '';
}

/**
 * Manejador centralizado de respuestas de error.
 *
 * @param res Objeto Response de Express
 * @param errorRaw El error crudo (objeto Error, string o null) para logging interno del servidor.
 * @param publicMessage Mensaje amigable que se enviará al cliente JSON (fallback si el error no es HttpError).
 * @param statusCode Código HTTP de la respuesta (Default: 500). Si el error es un HttpError o un error
 *                   de Prisma con traducción y aquí se deja el valor por defecto, manda el del error.
 */
const handleHttp = (
  res: Response,
  errorRaw: any,
  publicMessage: string = 'Error interno del servidor',
  statusCode: number = 500
) => {
  let status = statusCode;
  let message = publicMessage;

  // Errores de negocio: el mensaje y el estado del propio error tienen prioridad
  // (salvo que el controlador haya forzado explícitamente un estado distinto de 500).
  if (errorRaw instanceof HttpError) {
    message = errorRaw.message;
    status = statusCode === 500 ? errorRaw.status : statusCode;
  } else if (statusCode === 500) {
    const traducido = traducirErrorPrisma(errorRaw);
    if (traducido) {
      status = traducido.status;
      message = traducido.message;
    }
  }

  // 1. Registro interno. En los 500 va el diagnóstico completo, pero pasado por
  // describirErrorParaLog: el error crudo de Prisma lleva los argumentos de la
  // consulta (correos, DNI...). Los 4xx son ruido esperado: nivel warn y una línea.
  const req = res.req;
  const donde = req ? `${req.method} ${rutaParaRegistro(req.originalUrl ?? req.url ?? '')} ` : '';
  if (status >= 500) {
    console.error(`[HTTP ${status}] ${donde}${message}\n  ${describirErrorParaLog(errorRaw)}`);
  } else {
    console.warn(`[HTTP ${status}] ${donde}${message}${codigoParaLog(errorRaw)}`);
  }

  // 2. Respuesta al cliente
  res.status(status).json({ error: message });
};

export { handleHttp };
