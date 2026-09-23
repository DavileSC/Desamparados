
export interface DatosPapeleta {
  year: number;
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
