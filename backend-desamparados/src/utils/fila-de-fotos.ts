/**
 * Las fotos se procesan de una en una en todo el servidor.
 *
 * `sharp.concurrency(1)` solo limita los hilos de UNA foto: con varias subidas
 * a la vez, cada una ocupaba su hilo del grupo de libuv (cuatro por defecto).
 * En las pruebas de carga del 05-10-2026, seis editores subiendo a la vez
 * llenaron los dos núcleos del VPS (198 % de CPU en la API), y la web pública
 * se habría quedado esperando. En fila, quien sube tarda un poco más cuando
 * coincide con otro, pero siempre queda un núcleo para los visitantes.
 */
export class Fila {
  private ocupada = false;
  private esperando: Array<() => void> = [];

  async hacer<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.ocupada) await new Promise<void>((pasar) => this.esperando.push(pasar));
    this.ocupada = true;
    try {
      return await trabajo();
    } finally {
      // El turno pasa directamente al siguiente, sin soltar la fila: si se
      // soltara, una foto recién llegada podría colarse delante.
      const siguiente = this.esperando.shift();
      if (siguiente) siguiente();
      else this.ocupada = false;
    }
  }
}

const filaDeFotos = new Fila();

/** Procesa una foto con sharp cuando le toque. */
export const enFilaDeFotos = <T>(trabajo: () => Promise<T>): Promise<T> => filaDeFotos.hacer(trabajo);
