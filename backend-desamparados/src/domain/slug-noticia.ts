/**
 * La dirección de una noticia en la web: su título en minúsculas y sin
 * adornos, con el año detrás.
 *
 * Vive aquí, y no dentro de `NoticiaService`, porque el CMS tiene que decir la
 * misma dirección mientras se escribe el título (`desamparados-web/src/lib/
 * slug.ts`) y era un método privado que ningún test podía mirar. La tabla de
 * casos de `shared/casos-slug.json` la leen los tests de los dos lados: si uno
 * cambia, el otro se pone rojo.
 */
export function slugDeNoticia(titulo: string, anio: number | string): string {
  const base = titulo
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Tildes y diacríticos
    .replace(/ñ/g, 'n') // La ñ, aparte: su tilde no se quita, se cambia la letra
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  return `${base}-${anio}`;
}
