import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import db from '../config/db.js';
import { transactionWithRetry } from './transaction-retry.js';

/**
 * Contador de intentos fallidos con bloqueo temporal, en la base
 * (`FalloDeAcceso`).
 *
 * Lo usan el login (por email + IP y por email), el segundo factor y el cambio
 * de contraseña (por cuenta) y los DNI del área. Estuvo en memoria: cada
 * reinicio o despliegue levantaba todos los bloqueos, y quien estuviera
 * probando contraseñas volvía a tener sus cinco intentos (15-10-2026). Antes
 * aún eran `Map` sueltos sin límite que un bucle de emails inventados hacía
 * crecer sin freno: de ahí que las filas caduquen y cada contador tenga tope.
 */

interface OpcionesContador {
  /** Nombre del contador en la tabla: separa las claves de cada uso. Hasta 40 letras. */
  nombre: string;
  /** Fallos que disparan el bloqueo. */
  maxFallos: number;
  /** Cuánto dura el bloqueo. */
  bloqueoMs: number;
  /**
   * Bloqueo creciente: la duración de cada tanda (la primera, la segunda…;
   * de la última en adelante se repite). Con un bloqueo fijo, quien tiene la
   * contraseña de un cargo probaba cinco códigos del 2FA cada quince minutos
   * sin fin. Las tandas solo se olvidan con `limpiar` (un acierto) o tras
   * `olvidoTandasMs` sin fallar. Sin él, todas las tandas duran `bloqueoMs`.
   */
  escaladaMs?: number[];
  /** Sin fallos durante esto, las tandas vuelven a cero. Por defecto, `ventanaMs`. */
  olvidoTandasMs?: number;
  /** Un fallo más antiguo que esto ya no suma: el contador vuelve a cero. */
  ventanaMs: number;
  /** Máximo de claves sin bloqueo vivo que se guardan (ver `barrer`). */
  tope: number;
  /** Reloj inyectable para los tests. */
  ahora?: () => number;
}

interface Estado {
  fallos: number;
  ultimoFallo: number;
  bloqueadoHasta: number;
  /** Bloqueos que lleva la clave desde su último acierto. */
  tandas: number;
}

// Cada cuántos fallos de este proceso se barre: contar las filas en cada fallo
// sería una consulta más por intento, y pasarse del tope un rato no importa en
// disco como importaba en memoria.
const BARRER_CADA = 100;

/**
 * La columna admite 320 letras. Una clave más larga solo sale de un email que
 * no puede existir (el máximo es 254): se guarda su huella, que cuenta igual.
 */
function claveGuardada(clave: string): string {
  return clave.length <= 300 ? clave : `sha256:${crypto.createHash('sha256').update(clave).digest('hex')}`;
}

/** Otra petición creó la misma fila a la vez: repetir ya la encuentra. */
function esClaveRepetida(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

export class ContadorFallos {
  private fallosDesdeBarrido = 0;
  private readonly ahora: () => number;

  constructor(private readonly opciones: OpcionesContador) {
    this.ahora = opciones.ahora ?? Date.now;
  }

  private donde(clave: string) {
    return { contador_clave: { contador: this.opciones.nombre, clave: claveGuardada(clave) } };
  }

  /** Milisegundos de bloqueo que le quedan a la clave; 0 si puede intentarlo. */
  async restanteBloqueo(clave: string): Promise<number> {
    const fila = await db.falloDeAcceso.findUnique({ where: this.donde(clave), select: { bloqueadoHasta: true } });
    if (!fila) return 0;
    return Math.max(0, fila.bloqueadoHasta.getTime() - this.ahora());
  }

  /**
   * Apunta un fallo. Devuelve los milisegundos del bloqueo que acaba de
   * empezar, o 0 si este fallo no ha bloqueado: así quien llama sabe cuándo
   * avisar al titular, una vez por tanda y no a cada fallo.
   *
   * Leer y escribir van en una transacción con reintento: dos fallos a la vez
   * sobre la misma clave (un ataque en paralelo) no pueden contar por uno.
   */
  async registrarFallo(clave: string): Promise<number> {
    const donde = this.donde(clave);
    let bloqueo = 0;
    for (let intento = 1; ; intento += 1) {
      try {
        bloqueo = await transactionWithRetry(async (tx) => {
          const ahora = this.ahora();
          const fila = await tx.falloDeAcceso.findUnique({ where: donde });
          const antes: Estado | null = fila && {
            fallos: fila.fallos, ultimoFallo: fila.ultimoFallo.getTime(),
            bloqueadoHasta: fila.bloqueadoHasta.getTime(), tandas: fila.tandas,
          };
          const { estado, bloqueo } = this.conUnFalloMas(antes, ahora);
          const datos = {
            fallos: estado.fallos, tandas: estado.tandas,
            ultimoFallo: new Date(estado.ultimoFallo), bloqueadoHasta: new Date(estado.bloqueadoHasta),
          };
          if (fila) await tx.falloDeAcceso.update({ where: donde, data: datos });
          else await tx.falloDeAcceso.create({ data: { ...donde.contador_clave, ...datos } });
          return bloqueo;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
        break;
      } catch (e) {
        if (!esClaveRepetida(e) || intento >= 3) throw e;
      }
    }

    this.fallosDesdeBarrido += 1;
    if (this.fallosDesdeBarrido >= BARRER_CADA) await this.barrer();
    return bloqueo;
  }

  /** La cuenta de la clave tras un fallo más, y el bloqueo que empieza con él. */
  private conUnFalloMas(antes: Estado | null, ahora: number): { estado: Estado; bloqueo: number } {
    let estado: Estado;
    if (!antes || this.caducado(antes, ahora)) {
      estado = { fallos: 0, ultimoFallo: 0, bloqueadoHasta: 0, tandas: 0 };
    } else {
      estado = { ...antes };
      // Los fallos sueltos caducan con la ventana; las tandas, no.
      if (estado.bloqueadoHasta <= ahora && ahora - estado.ultimoFallo > this.opciones.ventanaMs) estado.fallos = 0;
    }

    estado.fallos += 1;
    estado.ultimoFallo = ahora;
    let bloqueo = 0;
    if (estado.fallos >= this.opciones.maxFallos) {
      const escalera = this.opciones.escaladaMs;
      bloqueo = escalera?.length ? escalera[Math.min(estado.tandas, escalera.length - 1)] : this.opciones.bloqueoMs;
      estado.bloqueadoHasta = ahora + bloqueo;
      estado.fallos = 0;
      estado.tandas += 1;
    }
    return { estado, bloqueo };
  }

  async limpiar(clave: string): Promise<void> {
    await db.falloDeAcceso.deleteMany({ where: this.donde(clave).contador_clave });
  }

  /** Borra todas las claves que empiezan así: las de una cuenta en cualquier red. */
  async limpiarPrefijo(prefijo: string): Promise<void> {
    // `startsWith` es un LIKE, y en él `_` vale por cualquier letra: un email
    // con guion bajo se llevaría por delante los contadores de otras cuentas.
    // Se buscan con LIKE y se filtran aquí con la comparación exacta.
    const filas = await db.falloDeAcceso.findMany({
      where: { contador: this.opciones.nombre, clave: { startsWith: prefijo } },
      select: { clave: true },
    });
    const claves = filas.map((f) => f.clave).filter((c) => c.startsWith(prefijo));
    if (claves.length) await db.falloDeAcceso.deleteMany({ where: { contador: this.opciones.nombre, clave: { in: claves } } });
  }

  /** Filas vivas de este contador (para los tests). */
  async contar(): Promise<number> {
    return db.falloDeAcceso.count({ where: { contador: this.opciones.nombre } });
  }

  /**
   * Quita lo caducado y, si aun así pasa del tope, las claves sin bloqueo vivo
   * más antiguas. Un bloqueo vivo no se quita nunca: si se fuera, inundar la
   * tabla de emails inventados serviría para desbloquear la cuenta atacada; ya
   * caducará.
   */
  async barrer(ahora = this.ahora()): Promise<void> {
    this.fallosDesdeBarrido = 0;
    const { nombre: contador, ventanaMs, olvidoTandasMs, tope } = this.opciones;
    const hecho = new Date(ahora);
    // Caducada: sin bloqueo vivo, y su último fallo y su último bloqueo, más
    // viejos que el plazo de olvido (el de las tandas si las tiene).
    const caducadas = (olvido: number, tandas: Prisma.IntFilter) => {
      const limite = new Date(ahora - olvido);
      return { contador, tandas, bloqueadoHasta: { lte: hecho, lt: limite }, ultimoFallo: { lt: limite } };
    };
    await db.falloDeAcceso.deleteMany({
      where: { OR: [caducadas(ventanaMs, { equals: 0 }), caducadas(olvidoTandasMs ?? ventanaMs, { gt: 0 })] },
    });

    const sobran = (await db.falloDeAcceso.count({ where: { contador } })) - tope;
    if (sobran <= 0) return;
    const antiguas = await db.falloDeAcceso.findMany({
      where: { contador, bloqueadoHasta: { lte: hecho } },
      orderBy: { ultimoFallo: 'asc' },
      take: sobran,
      select: { clave: true },
    });
    await db.falloDeAcceso.deleteMany({ where: { contador, clave: { in: antiguas.map((f) => f.clave) } } });
  }

  private caducado(estado: Estado, ahora: number): boolean {
    const olvido = estado.tandas > 0 ? (this.opciones.olvidoTandasMs ?? this.opciones.ventanaMs) : this.opciones.ventanaMs;
    return estado.bloqueadoHasta <= ahora && ahora - Math.max(estado.ultimoFallo, estado.bloqueadoHasta) > olvido;
  }
}

/**
 * Recuerda, durante un plazo, las redes desde las que cada cuenta ha acertado
 * la contraseña (`RedConfiada`): el bloqueo global por email no debe cerrarle
 * la puerta a su dueño. Va en la base por lo mismo que el contador: si el
 * bloqueo sobreviviera a un reinicio y esto no, el dueño se quedaría fuera.
 *
 * Solo se apunta tras acertar la contraseña, así que un atacante no puede
 * llenarlo con claves inventadas: basta con barrer lo caducado de vez en cuando.
 */
export class RegistroReciente {
  private apuntesDesdeBarrido = 0;
  private readonly ahora: () => number;

  constructor(private readonly opciones: { vigenciaMs: number; ahora?: () => number }) {
    this.ahora = opciones.ahora ?? Date.now;
  }

  async apuntar(clave: string): Promise<void> {
    const guardada = claveGuardada(clave);
    const vistaEn = new Date(this.ahora());
    try {
      await db.redConfiada.upsert({ where: { clave: guardada }, create: { clave: guardada, vistaEn }, update: { vistaEn } });
    } catch (e) {
      // Dos entradas buenas a la vez desde la misma red: la otra ya la creó.
      if (!esClaveRepetida(e)) throw e;
      await db.redConfiada.update({ where: { clave: guardada }, data: { vistaEn } });
    }
    this.apuntesDesdeBarrido += 1;
    if (this.apuntesDesdeBarrido >= BARRER_CADA) await this.barrer();
  }

  async tiene(clave: string): Promise<boolean> {
    const fila = await db.redConfiada.findUnique({ where: { clave: claveGuardada(clave) } });
    if (!fila) return false;
    return this.ahora() - fila.vistaEn.getTime() <= this.opciones.vigenciaMs;
  }

  /** Quita las redes que llevan más de la vigencia sin entrar. */
  async barrer(): Promise<void> {
    this.apuntesDesdeBarrido = 0;
    await db.redConfiada.deleteMany({ where: { vistaEn: { lt: new Date(this.ahora() - this.opciones.vigenciaMs) } } });
  }
}

/**
 * Lo que los contadores y las redes confiadas guardan de una cuenta: su
 * correo en claro (solo o con la red, «correo|ip») y su número (el doble
 * factor, el cambio de contraseña, los DNI del área). Al suprimirla (RGPD,
 * art. 17) se va todo: la cuenta ya no existe, y su correo y sus IP seguían
 * aquí semanas (auditoría del 22-10-2026, AUD-005).
 *
 * El prefijo se busca con LIKE y se filtra después con la comparación exacta,
 * como en `limpiarPrefijo`: un `_` del correo valdría por cualquier letra y se
 * llevaría los contadores de otra cuenta.
 */
export async function olvidarCuenta(email: string, userId: number): Promise<void> {
  const correo = email.trim().toLowerCase();
  const prefijo = `${correo}|`;
  const [fallos, redes] = await Promise.all([
    db.falloDeAcceso.findMany({ where: { OR: [{ clave: correo }, { clave: { startsWith: prefijo } }] }, select: { contador: true, clave: true } }),
    db.redConfiada.findMany({ where: { clave: { startsWith: prefijo } }, select: { clave: true } }),
  ]);
  const suyos = fallos.filter((f) => f.clave === correo || f.clave.startsWith(prefijo));
  await db.falloDeAcceso.deleteMany({
    where: {
      OR: [
        ...suyos.map((f) => ({ contador: f.contador, clave: f.clave })),
        { contador: { in: CONTADORES_POR_CUENTA }, clave: String(userId) },
      ],
    },
  });
  const suyas = redes.map((r) => r.clave).filter((c) => c.startsWith(prefijo));
  if (suyas.length) await db.redConfiada.deleteMany({ where: { clave: { in: suyas } } });
}

/** Los contadores cuya clave es el número de la cuenta (ver quién crea cada `ContadorFallos`). */
const CONTADORES_POR_CUENTA = ['doble-factor', 'cambio-de-contrasena', 'dni-desde-el-area'];

/**
 * Lo caducado, con reloj: el barrido de cada contador salta cada 100 fallos
 * de su proceso, y con pocos fallos (o un despliegue entre medias, que pone la
 * cuenta a cero) un correo mal escrito al entrar, con su IP, se quedaba en la
 * tabla indefinidamente. Lo llama cada hora `src/index.ts`.
 */
export async function barrerCaducados(ahora: number = Date.now()): Promise<void> {
  const hecho = new Date(ahora);
  // El plazo más largo de olvido de cualquier contador (las tandas del doble
  // factor, un día) más margen: aquí no se sabe de qué contador es cada fila,
  // y borrar antes de tiempo levantaría un bloqueo creciente.
  const limite = new Date(ahora - 2 * 24 * 3600 * 1000);
  await db.falloDeAcceso.deleteMany({ where: { bloqueadoHasta: { lte: hecho, lt: limite }, ultimoFallo: { lt: limite } } });
  // Las redes confiadas valen 30 días (`AuthService.redesConfiadas`).
  await db.redConfiada.deleteMany({ where: { vistaEn: { lt: new Date(ahora - 30 * 24 * 3600 * 1000) } } });
}
