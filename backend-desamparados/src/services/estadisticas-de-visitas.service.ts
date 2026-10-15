import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * El informe de GoAccess con las visitas de la web pública. No lo hace la
 * API: lo escribe cada hora un timer del servidor (docker/servidor/
 * estadisticas.sh) en `estadisticas/` del repositorio, que llega aquí por un
 * volumen de solo lectura. La API solo lo enseña, con sesión.
 */
export const RUTA_DEL_INFORME = path.resolve(process.cwd(), 'estadisticas', 'informe.html');

export interface EstadoDelInforme {
  hay: boolean;
  /** Cuándo lo escribió GoAccess por última vez. */
  actualizado: string | null;
}

export class EstadisticasDeVisitasService {
  /** Si hay informe y de cuándo: sin él, la pantalla explica qué falta en el servidor. */
  static async estado(): Promise<EstadoDelInforme> {
    try {
      const datos = await stat(RUTA_DEL_INFORME);
      return { hay: datos.isFile(), actualizado: datos.isFile() ? datos.mtime.toISOString() : null };
    } catch {
      return { hay: false, actualizado: null };
    }
  }
}
