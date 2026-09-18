import { TipoPrenda, EstadoPrenda } from '@prisma/client';

// =================================================================
//  1. ENSERES (Lotes: Viacrucis, Hachetas, etc.)
// =================================================================

export interface CreateEnserDto {
  nombre: string;
  referencia?: string; // Sustituye al antiguo 'codigo'
  categoria?: string;
  ubicacion?: string;
  
  // Las nuevas cantidades desglosadas
  cantidadOptimo?: number;
  cantidadBueno?: number;
  cantidadReparar?: number;
  
  imagenUrl?: string | null;
  fechaAdquisicion?: string; // ISO Date string
}

export interface UpdateEnserDto {
  nombre?: string;
  referencia?: string;
  categoria?: string;
  ubicacion?: string;
  
  cantidadOptimo?: number;
  cantidadBueno?: number;
  cantidadReparar?: number;
  
  imagenUrl?: string | null;
  fechaAdquisicion?: string;
}

export interface EnserFilterDto {
  search?: string;     // Buscar por nombre/referencia
  categoria?: string;
  ubicacion?: string;
  necesitaReparacion?: string; // 'true' o 'false' desde el query string
  orden?: string;
}

// =================================================================
//  2. ROPERO (Prendas unitarias: Túnicas, Capirotes, etc.)
// =================================================================

export interface CreatePrendaDto {
  numero: string; // Ej: "TUN-001"
  tipo: TipoPrenda;
  talla?: string;
  estado?: EstadoPrenda; // Si no viene, Prisma pone 'DISPONIBLE' por defecto
  observaciones?: string;
}

export interface UpdatePrendaDto {
  numero?: string;
  tipo?: TipoPrenda;
  talla?: string;
  estado?: EstadoPrenda;
  observaciones?: string;
}

export interface PrendaFilterDto {
  /** Búsqueda libre: número, talla, observaciones o quien la tiene prestada. */
  q?: string;
  numero?: string;
  tipo?: TipoPrenda;
  estado?: EstadoPrenda;
  talla?: string;
  orden?: string;
}
