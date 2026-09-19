import { TipoPublicacion } from '@prisma/client';

export interface CreatePublicationDto {
  titulo: string;
  descripcion?: string;
  imagenUrl?: string | null; // '' o null = sin portada
  archivoUrl: string;
  fecha?: string;
  categoria: TipoPublicacion;
  visible?: boolean;
}

export interface UpdatePublicationDto {
  titulo?: string;
  descripcion?: string;
  imagenUrl?: string | null; // '' o null = sin portada
  archivoUrl?: string;
  fecha?: string;
  categoria?: TipoPublicacion;
  visible?: boolean;
}

export interface AdminPublicationFilterDto {
  page?: unknown;
  limit?: unknown;
  q?: string; // Palabras que buscar en el título y la descripción
  estado?: 'publicadas' | 'borradores' | 'incompletas';
  categoria?: TipoPublicacion;
}
