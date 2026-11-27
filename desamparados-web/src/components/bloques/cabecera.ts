import CATALOGO from '../../../../shared/paginas-publicas.json'
import { aplanarMenu, menuPublico, ponerNombres, type EntradaMenu } from '../../config/navegacion'
import { CABECERA_CON_COPIA } from '../../config/fotosDeLaInstalacion'

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

/**
 * Como `seccionesHasta`, pero una página que no sale en el menú (el Rosario,
 * apartado de Cultos) toma el camino de la página de la que cuelga por su
 * ruta, con ella dentro: «Corporación · Cultos».
 */
function caminoHasta(ruta: string, menu: EntradaMenu[]): string[] | null {
  const camino = seccionesHasta(ruta, menu)
  if (camino) return camino
  const padre = ruta.slice(0, ruta.lastIndexOf('/'))
  if (!padre) return null
  const entrada = aplanarMenu(menu).find((e) => e.href === padre)
  const arriba = caminoHasta(padre, menu)
  return entrada && arriba ? [...arriba, entrada.label] : null
}

const normal = (texto: string) => texto.trim().toLocaleLowerCase('es')

/**
 * La línea pequeña de encima del título: dónde está la página en el menú
 * («Corporación · Sábado de Pasión» en Enseres). Sale del menú y no se escribe
 * en el CMS, para que no pueda quedarse desfasada si el menú cambia. Una
 * sección que se llama como la propia página no se repite, y las de primer
 * nivel (Contacto) no llevan ninguna. Con los nombres del menú que se pusieron
 * en el CMS (`useNombresEnMenu`), como los ve el visitante en la barra.
 */
export function cejaDePagina(slug: string, titulo: string, nombres: Readonly<Record<string, string>> = {}): string[] {
  const ruta = RUTAS.get(slug)
  if (!ruta) return []
  return (caminoHasta(ruta, ponerNombres(menuPublico, nombres)) ?? []).filter((seccion) => normal(seccion) !== normal(titulo))
}

/**
 * Las fotos de cabecera de la instalación (`instalacion/imagenes/cabeceras/`)
 * tienen una copia de 1000 px al lado, con `-1000` en el nombre: el móvil se
 * baja esa (el convenio, en `config/fotosDeLaInstalacion.ts`). Una foto subida
 * desde el CMS es un solo fichero.
 */
export function srcSetDeCabecera(url: string): string | undefined {
  const m = CABECERA_CON_COPIA.exec(url)
  return m ? `${m[1]}-1000.webp 1000w, ${url} 2000w` : undefined
}
