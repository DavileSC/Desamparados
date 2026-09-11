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
