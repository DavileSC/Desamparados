import type { Modulo } from '../../../../domain/modulos'

/**
 * La misma regla que el servidor (backend `enlaceValido`): una página de la
 * web (`/agenda`), una dirección segura o un correo. Se comprueba aquí para
 * decirlo al escribir, no al guardar.
 */
export function enlaceValido(enlace: string): boolean {
  const e = enlace.trim()
  if (/^\/(?!\/)\S*$/.test(e)) return true
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(e)) return true
  try {
    const url = new URL(e)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

/** Las páginas a las que más se manda desde un correo, para elegirlas sin escribir la dirección. */
export const PAGINAS_DE_LA_WEB: { nombre: string; ruta: string; modulo?: Modulo }[] = [
  { nombre: 'Área de hermanos', ruta: '/area-hermano' },
  { nombre: 'Portada', ruta: '/' },
  { nombre: 'Agenda', ruta: '/agenda', modulo: 'agenda' },
  { nombre: 'Noticias', ruta: '/noticias', modulo: 'noticias' },
  { nombre: 'Hazte hermano', ruta: '/hazte-hermano', modulo: 'alta-web' },
  { nombre: 'Tienda', ruta: '/tienda', modulo: 'tienda-web' },
  { nombre: 'Contacto', ruta: '/contacto' },
]

export const AYUDA_ENLACE = 'Una página de la web empieza por / (por ejemplo, /agenda). Fuera de la web, la dirección entera, con https://.'
