/**
 * La dirección que tendrá una noticia en la web.
 *
 * Es el espejo de `NewsService.generateSlug`: quien la pone de verdad es el
 * servidor al guardar, y el CMS la enseña mientras se escribe el título para
 * que no sea una sorpresa. Si las dos se separan, el CMS promete una dirección
 * y la noticia acaba en otra, sin que nadie se entere hasta que alguien
 * comparte el enlace.
 *
 * No se comparte el código porque el backend compila solo lo que hay bajo
 * `src/`; lo que sí se comparte es la tabla de casos
 * (`shared/casos-slug.json`), que leen los tests de los dos lados: si uno
 * cambia, el otro se pone rojo. Es lo que ya se hace con el DNI y el teléfono
 * en `shared/casos-identidad.json`.
 */
export function slugDeNoticia(titulo: string, anio: number | string): string {
  const base = titulo
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // Tildes y diacríticos
    .replace(/ñ/g, 'n') // La ñ, aparte: su tilde no se quita, se cambia la letra
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
  return `${base}-${anio}`
}

/**
 * Lo que el CMS propone bajo el campo de la dirección. Con un título que no
 * deja ninguna letra ni cifra («¿?»), no propone nada: «-2026» no es una
 * dirección que enseñarle a nadie, y el servidor tampoco la va a usar porque
 * sin título no se guarda.
 */
export function direccionAutomatica(titulo: string, fecha: string): string {
  const anio = fecha.slice(0, 4) || String(new Date().getFullYear())
  const propuesta = slugDeNoticia(titulo, anio)
  return propuesta.startsWith('-') ? '' : propuesta
}
