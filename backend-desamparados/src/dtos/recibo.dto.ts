// src/dtos/recibo.dto.ts

export interface GenerarCuotasDto {
  year: number;
  importe: number; // El admin lo envía como número (ej: 25.50)
  concepto: string;
}

export interface UpdateReciboDto {
  estado?: 'PENDIENTE' | 'PAGADO' | 'DEVUELTO';
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