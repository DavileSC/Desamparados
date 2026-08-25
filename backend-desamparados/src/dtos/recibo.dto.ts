// src/dtos/recibo.dto.ts

export interface GenerarCuotasDto {
  year: number;
  importe: number; // El admin lo envía como número (ej: 25.50)
  concepto: string;
}

import { MetodoPago } from '@prisma/client';

export interface UpdateReciboDto {
  estado?: 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO';
  metodoPago?: MetodoPago;
  puesto?: string;
  tramo?: string;
  observaciones?: string;
}

// Para el filtro de búsqueda del admin
export interface ReciboFilterDto {
  year?: number;
  estado?: 'PENDIENTE' | 'PAGADO' | 'DEVUELTO';
  hermanoId?: number;
}
