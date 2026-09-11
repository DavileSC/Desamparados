import { TipoEvento } from '@prisma/client'; // Importamos el Enum nativo de Prisma

// Re-exportamos para usarlo en el frontend/controller si hace falta
export { TipoEvento };

export type EventVisibility = 'public' | 'members_only';

export interface CreateEventDto {
  title: string;
  description?: string;
  startDate: string; 
  endDate?: string | null;
  location?: string;
  visibility: EventVisibility;
  type: TipoEvento; // <--- OBLIGATORIO
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string | null;
  location?: string;
  visibility?: EventVisibility;
  type?: TipoEvento; // <--- OPCIONAL
}

export interface EventFilterDto {
  from?: string;
  to?: string;
  type?: TipoEvento; // <--- Nuevo filtro
}

/** Las dos pestañas del listado de la agenda en el CMS. */
export type PeriodoAgenda = 'proximos' | 'pasados';
