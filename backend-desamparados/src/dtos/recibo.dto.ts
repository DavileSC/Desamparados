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
