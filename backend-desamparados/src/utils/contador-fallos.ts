/**
 * Contador de intentos fallidos con bloqueo temporal, en memoria.
 *
 * Lo usan el login (por email + IP y por email) y el segundo factor (por
 * cuenta). Antes eran `Map` sueltos sin límite: cada email inventado dejaba
 * una entrada para siempre, así que bastaba un bucle de emails aleatorios para
 * hacer crecer la memoria del proceso sin freno. Aquí las entradas caducan y
 * el total tiene tope.
 *
 * En memoria: suficiente para una instancia. Con varias habría que moverlo a
 * Redis o a la base de datos.
 */

export interface OpcionesContador {
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
  /** Máximo de claves vivas a la vez. */
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

// Cada cuántos fallos se barre aunque no se haya llegado al tope, para que las
// entradas caducadas no se queden esperando a que el mapa se llene.
const BARRER_CADA = 100;

export class ContadorFallos {
  private readonly estados = new Map<string, Estado>();
  private fallosDesdeBarrido = 0;
  private readonly ahora: () => number;

  constructor(private readonly opciones: OpcionesContador) {
    this.ahora = opciones.ahora ?? Date.now;
  }

  /** Milisegundos de bloqueo que le quedan a la clave; 0 si puede intentarlo. */
  restanteBloqueo(clave: string): number {
    const estado = this.estados.get(clave);
    if (!estado) return 0;
    return Math.max(0, estado.bloqueadoHasta - this.ahora());
  }

  /**
   * Apunta un fallo. Devuelve los milisegundos del bloqueo que acaba de
   * empezar, o 0 si este fallo no ha bloqueado: así quien llama sabe cuándo
   * avisar al titular, una vez por tanda y no a cada fallo.
   */
  registrarFallo(clave: string): number {
    const ahora = this.ahora();
    let estado = this.estados.get(clave);
    if (!estado || this.caducado(estado, ahora)) {
      estado = { fallos: 0, ultimoFallo: 0, bloqueadoHasta: 0, tandas: 0 };
    } else if (estado.bloqueadoHasta <= ahora && ahora - estado.ultimoFallo > this.opciones.ventanaMs) {
      // Los fallos sueltos caducan con la ventana; las tandas, no.
      estado.fallos = 0;
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

    // Borrar y volver a meter: el Map conserva el orden de inserción, así la
    // primera clave es siempre la de actividad más antigua.
    this.estados.delete(clave);
    this.estados.set(clave, estado);

    this.fallosDesdeBarrido += 1;
    if (this.estados.size > this.opciones.tope || this.fallosDesdeBarrido >= BARRER_CADA) {
      this.barrer(ahora);
    }
    return bloqueo;
  }

  limpiar(clave: string): void {
    this.estados.delete(clave);
  }

  /** Borra todas las claves que empiezan así: las de una cuenta en cualquier red. */
  limpiarPrefijo(prefijo: string): void {
    for (const clave of this.estados.keys()) {
      if (clave.startsWith(prefijo)) this.estados.delete(clave);
    }
  }

  get tamano(): number {
    return this.estados.size;
  }

  /** Quita lo caducado y, si aun así sobra, lo más antiguo. */
  barrer(ahora = this.ahora()): void {
    this.fallosDesdeBarrido = 0;
    for (const [clave, estado] of this.estados) {
      if (this.caducado(estado, ahora)) this.estados.delete(clave);
    }
    if (this.estados.size <= this.opciones.tope) return;

    // Una ráfaga de claves distintas dentro de la ventana. Primero se sacrifican
    // las que no están bloqueadas: si se fuera un bloqueo vivo, inundar el mapa
    // de emails inventados serviría para desbloquear la cuenta atacada.
    for (const [clave, estado] of this.estados) {
      if (this.estados.size <= this.opciones.tope) return;
      if (estado.bloqueadoHasta <= ahora) this.estados.delete(clave);
    }
    for (const clave of this.estados.keys()) {
      if (this.estados.size <= this.opciones.tope) return;
      this.estados.delete(clave);
    }
  }

  private caducado(estado: Estado, ahora: number): boolean {
    const olvido = estado.tandas > 0 ? (this.opciones.olvidoTandasMs ?? this.opciones.ventanaMs) : this.opciones.ventanaMs;
    return estado.bloqueadoHasta <= ahora && ahora - Math.max(estado.ultimoFallo, estado.bloqueadoHasta) > olvido;
  }
}

/**
 * Recuerda, durante un plazo, claves que han hecho algo bien. Lo usa el login
 * para saber desde qué redes ha entrado de verdad cada cuenta: el bloqueo
 * global por email no debe cerrarle la puerta a su dueño.
 *
 * Solo se apunta tras acertar la contraseña, así que un atacante no puede
 * llenarlo con claves inventadas; el tope es por si acaso. Mismo criterio que
 * el contador: al pasar del tope se va la de actividad más antigua.
 */
export class RegistroReciente {
  private readonly vistas = new Map<string, number>();
  private readonly ahora: () => number;

  constructor(private readonly opciones: { vigenciaMs: number; tope: number; ahora?: () => number }) {
    this.ahora = opciones.ahora ?? Date.now;
  }

  apuntar(clave: string): void {
    this.vistas.delete(clave);
    this.vistas.set(clave, this.ahora());
    if (this.vistas.size > this.opciones.tope) {
      const limite = this.ahora() - this.opciones.vigenciaMs;
      for (const [k, cuando] of this.vistas) {
        if (cuando < limite) this.vistas.delete(k);
      }
      for (const k of this.vistas.keys()) {
        if (this.vistas.size <= this.opciones.tope) break;
        this.vistas.delete(k);
      }
    }
  }

  tiene(clave: string): boolean {
    const cuando = this.vistas.get(clave);
    if (cuando === undefined) return false;
    if (this.ahora() - cuando > this.opciones.vigenciaMs) {
      this.vistas.delete(clave);
      return false;
    }
    return true;
  }

  get tamano(): number {
    return this.vistas.size;
  }
}
