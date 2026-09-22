import { useEffect, useMemo } from 'react'
import { site } from '../config/site'
import type { Noticia } from '../types'

const DOMINIO = 'https://www.desamparadosmalaga.com'

/**
 * La noticia, descrita para los buscadores (schema.org `NewsArticle`).
 *
 * Es lo que permite que en Google salga con su fecha y su foto en vez de como
 * un resultado más. Los datos del Grupo Parroquial van en `index.html`, que
 * describe a la entidad; esto describe **una** noticia, así que viaja con ella.
 *
 * No va por Helmet aunque sea una etiqueta de la cabecera: esta versión de
 * `react-helmet-async` inyecta `<title>` y `<meta>`, pero **descarta los
 * `<script>`**, así que la ficha no llegaba a la página. Se pone a mano.
 *
 * Y se retira al salir: en una web de una sola página, la ficha de la noticia
 * anterior seguiría en la cabecera mientras se lee la siguiente.
 *
 * Solo se declara lo que se sabe. Sin foto no se inventa una: un `image` vacío
 * invalida la ficha entera, y una ficha inválida es peor que ninguna.
 */
export default function FichaDeNoticia({ noticia }: { noticia: Noticia }) {
  const ficha = useMemo(() => {
    const datos: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: noticia.titulo,
      description: noticia.extracto,
      datePublished: noticia.fecha,
      articleSection: noticia.categoria,
      mainEntityOfPage: `${DOMINIO}/actualidad/noticias/${noticia.slug}`,
      publisher: {
        '@type': 'ReligiousOrganization',
        name: site.nombre,
        url: `${DOMINIO}/`,
      },
    }
    if (noticia.imagen) datos.image = noticia.imagen
    return JSON.stringify(datos)
  }, [noticia])

  useEffect(() => {
    const guion = document.createElement('script')
    guion.type = 'application/ld+json'
    guion.dataset.ficha = 'noticia'
    guion.textContent = ficha
    document.head.appendChild(guion)
    return () => { guion.remove() }
  }, [ficha])

  return null
}
