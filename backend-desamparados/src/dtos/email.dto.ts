
import type { CobroSalida } from '@prisma/client';
import type { Articulo } from '../domain/articulos.js';

/** Lo de la salida que cambia la papeleta: el título, la frase del importe y las indicaciones. */
export interface SalidaImpresa {
  nombre: string;
  cobro: CobroSalida;
  conRopa: boolean;
  indicaciones: string | null;
  /** Con qué se escribe «del Sábado de Pasión» o «de la Procesión Magna» (domain/articulos.ts). */
  articulo: Articulo;
}
