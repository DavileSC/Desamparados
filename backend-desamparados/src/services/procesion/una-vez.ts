/**
 * Operaciones de la mesa que se hacen una sola vez aunque lleguen dos veces.
 *
 * La mesa trabaja con una WiFi que se corta. Si se cobra y la respuesta no
 * llega, quien atiende vuelve a pulsar: sin esto, se cobraría dos veces. Cada
 * operación trae una clave que el ordenador genera al abrirla y repite en
 * cada reintento; la primera vez que llega se guarda dentro de la misma
 * transacción que la operación, así que o quedan las dos o ninguna. Si la
 * clave ya está, se devuelve lo que se hizo entonces.
 */
import { Prisma } from '@prisma/client';
import db from '../../config/db.js';
import { HttpError } from '../../utils/error.handle.js';
import { transactionWithRetry } from '../../utils/transaction-retry.js';

type Tx = Prisma.TransactionClient;

interface Resultado<T> {
  resultado: T;
  /** La operación ya se había hecho con esta clave: no se ha vuelto a hacer. */
  repetida: boolean;
}

const esClaveRepetida = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

async function leida<T>(clave: string, tipo: string): Promise<Resultado<T> | null> {
  const hecha = await db.operacionMesa.findUnique({ where: { clave } });
  if (!hecha) return null;
  if (hecha.tipo !== tipo) throw new HttpError('Esa clave de operación ya se usó para otra cosa. Recarga la mesa.', 409);
  return { resultado: hecha.resultado as T, repetida: true };
}

/**
 * Hace `operacion` dentro de una transacción serializable, una sola vez por
 * `clave`. Lo que devuelve tiene que poder guardarse como JSON: es lo que
 * recibe también quien repite la petición.
 */
export async function unaVez<T>(clave: string | undefined, tipo: string, operacion: (tx: Tx) => Promise<T>): Promise<Resultado<T>> {
  const opciones = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
  if (!clave) return { resultado: await transactionWithRetry(operacion, opciones), repetida: false };

  const antes = await leida<T>(clave, tipo);
  if (antes) return antes;

  try {
    const resultado = await transactionWithRetry(async (tx) => {
      await tx.operacionMesa.create({ data: { clave, tipo } });
      const hecho = await operacion(tx);
      await tx.operacionMesa.update({ where: { clave }, data: { resultado: hecho as Prisma.InputJsonValue } });
      return hecho;
    }, opciones);
    return { resultado, repetida: false };
  } catch (error) {
    // Las dos peticiones llegaron a la vez: la otra ya la hizo.
    if (esClaveRepetida(error)) {
      const otra = await leida<T>(clave, tipo);
      if (otra) return otra;
    }
    throw error;
  }
}

/** Las claves se guardan unos días: bastan para cualquier reintento. */
const DIAS_QUE_SE_GUARDAN = 30;

export async function olvidarOperacionesViejas(ahora: Date = new Date()) {
  const limite = new Date(ahora.getTime() - DIAS_QUE_SE_GUARDAN * 24 * 60 * 60 * 1000);
  const { count } = await db.operacionMesa.deleteMany({ where: { createdAt: { lt: limite } } });
  return count;
}
