// src/dtos/news.dto.ts

export interface CreateNewsDto {
  titulo: string;
  extracto?: string;  // Resumen corto para listados
  contenido: string;  // HTML o Markdown del cuerpo
  imagenUrl?: string | null; // Ruta de la imagen destacada; '' o null = sin foto
  visible?: boolean;  // Borrador o Publicada
  fecha?: string;     // ISO String. Opcional (si no viene, es hoy)
  slug?: string;      // Opcional, por si el SEO quiere forzar uno
}

export interface UpdateNewsDto {
  titulo?: string;
  extracto?: string;
  contenido?: string;
  imagenUrl?: string | null;
  visible?: boolean;
  fecha?: string;
  slug?: string;
}

export interface NewsFilterDto {
  page?: unknown;
  limit?: unknown;
  search?: string; // Para buscar por título en el archivo
  includeDrafts?: boolean; // SOLO para el panel CMS: incluye noticias con visible:false
}