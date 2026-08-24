export interface DatosPapeleta {
  year: number;
  importe: string; // Ya formateado "25,00 €"
  concepto: string;
  puesto?: string | null;
  tramo?: string | null;
  fechaSalida: string; // "Jueves Santo, 28 de Marzo"
  horaSalida: string;  // "19:30h"
  accesoPuerta: string; // "Puerta de la Casa Hermandad"
  observaciones?: string | null;
}