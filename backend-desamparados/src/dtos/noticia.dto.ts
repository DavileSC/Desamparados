// src/dtos/noticia.dto.ts

export interface CrearNoticiaDto {
  titulo: string;
  extracto?: string;  // Resumen corto para listados
  contenido: string;  // HTML o Markdown del cuerpo
  imagenUrl?: string | null; // Ruta de la imagen destacada; '' o null = sin foto
  visible?: boolean;  // Borrador o Publicada
  fecha?: string;     // ISO String. Opcional (si no viene, es hoy)
  slug?: string;      // Opcional, por si el SEO quiere forzar uno
}

export interface ActualizarNoticiaDto {
  titulo?: string;
  extracto?: string;
  contenido?: string;
  imagenUrl?: string | null;
  visible?: boolean;
  fijada?: boolean;   // La destacada de la portada: una sola y publicada
  fecha?: string;
  slug?: string;
}

export interface FiltroNoticiasDto {
  page?: unknown;
  limit?: unknown;
  search?: string; // Para buscar por título en el archivo
}

export interface FiltroNoticiasCmsDto {
  page?: unknown;
  limit?: unknown;
  q?: string; // Palabras que buscar en el título y el extracto
  estado?: 'publicadas' | 'borradores' | 'incompletas';
}