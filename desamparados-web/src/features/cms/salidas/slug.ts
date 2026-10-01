/** El nombre corto de la dirección, a partir del nombre: lo que valida la API (`^[a-z0-9]+(-[a-z0-9]+)*$`). */
export const slugDe = (nombre: string) =>
  nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
