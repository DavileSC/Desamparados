/**
 * Lo que la web enseña, ya masticado para las pantallas: el tipo con el que
 * hablan las tarjetas, los listados y las fichas. La capa de `lib/api` traduce
 * a esto lo que responde el backend.
 *
 * `slug` se queda con su nombre: es la dirección con la que una noticia o una
 * publicación vive en la URL, y así se llama también en el backend.
 */
export interface Noticia {
  id: string
  titulo: string
  extracto: string
  contenido?: string
  imagen?: string
  categoria: string
  fecha: string
  slug: string
  /** Destacada a mano en el CMS: en la portada va primera y con cinta. */
  fijada?: boolean
}

export interface Acto {
  id: string
  titulo: string
  descripcion: string
  fecha: string
  hora?: string
  lugar?: string
  destacado?: boolean
}

export interface Publicacion {
  id: string
  titulo: string
  descripcion?: string
  imagen?: string
  archivoUrl?: string
  fecha: string
  categoria: 'boletin' | 'dossier' | 'anuario' | 'historia'
  /** Destacada a mano en el CMS: en la portada va primera y con cinta. */
  fijada?: boolean
  /** Letra y velo de la cubierta según la foto; sin ella, la letra de siempre. */
  tintaPortada?: TintaDePortada
}

/** Una zona de la cubierta con texto: qué letra lleva y cuánto velo debajo (0 a 0,8). */
export interface TintaDeZona {
  letra: 'clara' | 'oscura'
  velo: number
}

/** La calcula la API al guardar la portada (`domain/tinta-de-portada.ts`). */
export interface TintaDePortada {
  arriba: TintaDeZona
  abajo: TintaDeZona
}
