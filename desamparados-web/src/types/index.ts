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
}
