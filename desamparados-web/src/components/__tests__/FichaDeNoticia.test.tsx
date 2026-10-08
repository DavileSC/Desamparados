import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import FichaDeNoticia from '../FichaDeNoticia'
import type { Noticia } from '../../types'
import { site } from '../../config/site'

const NOTICIA: Noticia = {
  id: '1',
  titulo: 'Triduo en honor a la Titular',
  extracto: 'Tres días de cultos en la parroquia.',
  categoria: 'Cultos',
  fecha: '2026-03-12T00:00:00.000Z',
  slug: 'triduo-titular',
  imagen: 'https://www.desamparadosmalaga.com/storage/public/fotos/triduo.webp',
}

const enLaCabecera = () => document.head.querySelector('script[data-ficha="noticia"]')

async function fichaDe(noticia: Noticia) {
  const vista = render(<FichaDeNoticia noticia={noticia} />)
  await waitFor(() => expect(enLaCabecera()).not.toBeNull())
  return { ficha: JSON.parse(enLaCabecera()!.textContent!) as Record<string, unknown>, vista }
}

describe('FichaDeNoticia', () => {
  it('describe la noticia como NewsArticle, con su fecha y su sección', async () => {
    const { ficha } = await fichaDe(NOTICIA)
    expect(ficha['@type']).toBe('NewsArticle')
    expect(ficha.headline).toBe(NOTICIA.titulo)
    expect(ficha.datePublished).toBe(NOTICIA.fecha)
    expect(ficha.articleSection).toBe('Cultos')
    expect(ficha.mainEntityOfPage).toBe(`${site.url}/noticias/triduo-titular`)
    expect(ficha.image).toBe(NOTICIA.imagen)
  })

  it('sin foto no declara una vacía: una ficha inválida es peor que ninguna', async () => {
    const { ficha } = await fichaDe({ ...NOTICIA, imagen: undefined })
    expect('image' in ficha).toBe(false)
  })

  it('al salir de la noticia la ficha se va con ella', async () => {
    // En una web de una sola página, si no se retirase, la ficha de la noticia
    // anterior seguiría anunciándose mientras se lee la siguiente.
    const { vista } = await fichaDe(NOTICIA)
    vista.unmount()
    expect(enLaCabecera()).toBeNull()
  })
})
