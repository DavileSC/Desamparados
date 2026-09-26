import CATALOGO from '../../../../shared/paginas-publicas.json'
import { menuPublico, type EntradaMenu } from '../../config/navegacion'
import type { SlugContenido } from '../../lib/api/contenido'

/**
 * Qué cabecera lleva cada página de bloques. Lo leen la web, para pintarla, y
 * el CMS, para explicar al editar qué se hace con la foto.
 *
 * - Agenda y Cultos, ninguna: su contenido ya dice qué página es (el
 *   calendario, el rostro de la Virgen). La foto, si la hay, queda velada
 *   detrás de toda la página.
 * - Historia, la suya propia (`HistoriaPage`), también con la foto velada.
 * - Las demás, la cabecera a sangre (`CabeceraASangre`): la foto a todo el
 *   ancho y el título apoyado en su borde de abajo.
 */
export const SIN_CABECERA: readonly SlugContenido[] = ['agenda', 'cultos']

export type TipoDeCabecera = 'a-sangre' | 'ninguna' | 'propia'

export function tipoDeCabecera(slug: string): TipoDeCabecera {
  if (slug === 'historia') return 'propia'
  return (SIN_CABECERA as readonly string[]).includes(slug) ? 'ninguna' : 'a-sangre'
}

/** Encuadre de partida: el punto de la foto (en % de su alto) que se queda a la vista. */
export const ENCUADRE_POR_DEFECTO = 40

const RUTAS = new Map(CATALOGO.paginas.map((p) => [p.slug, p.ruta]))

/** Las secciones del menú por las que se llega a `ruta`, de fuera adentro. */
function seccionesHasta(ruta: string, entradas: EntradaMenu[], camino: string[] = []): string[] | null {
  for (const entrada of entradas) {
    // Primero las de dentro: «Publicaciones» es a la vez sección y, dentro,
    // «Todas las publicaciones» con la misma ruta; manda la hoja.
    if (entrada.hijos) {
      const dentro = seccionesHasta(ruta, entrada.hijos, [...camino, entrada.label])
      if (dentro) return dentro
    }
    if (entrada.href === ruta) return camino
  }
  return null
}

const normal = (texto: string) => texto.trim().toLocaleLowerCase('es')

/**
 * La línea pequeña de encima del título: dónde está la página en el menú
 * («Corporación · Sábado de Pasión» en Enseres). Sale del menú y no se escribe
 * en el CMS, para que no pueda quedarse desfasada si el menú cambia. Una
 * sección que se llama como la propia página no se repite, y las de primer
 * nivel (Contacto) no llevan ninguna.
 */
export function cejaDePagina(slug: string, titulo: string): string[] {
  const ruta = RUTAS.get(slug)
  if (!ruta) return []
  return (seccionesHasta(ruta, menuPublico) ?? []).filter((seccion) => normal(seccion) !== normal(titulo))
}

/**
 * Las fotos de cabecera del repositorio (`/images/cabeceras/`) tienen una copia
 * de 1000 px al lado, con `-1000` en el nombre: el móvil se baja esa. Una foto
 * subida desde el CMS es un solo fichero.
 */
export function srcSetDeCabecera(url: string): string | undefined {
  const m = /^(\/images\/cabeceras\/[\w-]+)\.webp$/.exec(url)
  return m ? `${m[1]}-1000.webp 1000w, ${url} 2000w` : undefined
}
