// src/dtos/pagina.dto.ts

export interface SavePaginaDto {
  slug: string;      // Identificador único (ej: "quienes-somos", "historia")
  titulo: string;    // Título H1 de la página
  contenido: string; // HTML o Markdown
}

// Opcional: Si en el futuro quieres editar solo el título sin mandar todo el contenido
export interface UpdatePaginaDto {
  titulo?: string;
  contenido?: string;
}