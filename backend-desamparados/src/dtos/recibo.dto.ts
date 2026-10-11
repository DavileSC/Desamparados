// src/dtos/recibo.dto.ts

import { MetodoPago } from '@prisma/client';

export interface GenerarCuotasDto {
  year: number;
  importe: number; // El admin lo envía como número (ej: 25.50)
  concepto: string;
}

// Emisión de un recibo suelto desde Tesorería. Las papeletas no se emiten por
// aquí: nacen en la mesa de reparto junto con su papeleta de sitio.
export type TipoReciboEmitible = 'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO';

export interface EmitirReciboDto {
  hermanoId: number;
  year: number;
  concepto: string;
  importe: number;
  tipo: TipoReciboEmitible;
}

export interface UpdateReciboDto {
  estado?: 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO' | 'REEMBOLSADO';
  metodoPago?: MetodoPago;
  puesto?: string;
  tramo?: string;
  observaciones?: string;
  /** Lo que cobra el banco al devolver el recibo: se apunta como gasto. */
  comision?: number;
  /** AAAA-MM-DD: el día en que el banco lo devolvió, para el reverso y la comisión. Hoy si no se dice. */
  fechaDevolucion?: string;
}

