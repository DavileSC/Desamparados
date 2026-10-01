
import type { CobroSalida } from '@prisma/client';
import type { Articulo } from '../domain/articulos.js';

/** Lo de la salida que cambia la papeleta: el título, la frase del importe, la normativa y las indicaciones. */
export interface SalidaImpresa {
  nombre: string;
  cobro: CobroSalida;
  conRopa: boolean;
  indicaciones: string | null;
  /** Con qué se escribe «del Sábado de Pasión» o «de la Procesión Magna» (domain/articulos.ts). */
  articulo: Articulo;
}

export interface DatosPapeleta {
  year: number;
  /** De qué salida es: da el título, el nombre del importe y el recuadro de indicaciones. */
  salida: SalidaImpresa;
  importe: string; // Ya formateado "25,00 €"
  concepto: string;
  /** El id de la papeleta: sale como «N.º 2027-0123» para buscarla en Secretaría. */
  papeletaId?: number | null;
  puesto?: string | null;
  tramo?: string | null;
  /** Código de la túnica asignada ese año, si la lleva del Grupo. */
  tunica?: string | null;
  fechaSalida: string; // "Jueves Santo, 28 de Marzo"
  horaSalida: string;  // "19:30h"
  accesoPuerta: string; // "Puerta de la Casa Grupo Parroquial"
  observaciones?: string | null;
}
