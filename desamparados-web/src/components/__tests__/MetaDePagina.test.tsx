import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import MetaDePagina from '../MetaDePagina'
import { quitarMetaEstaticas } from '../../lib/metaEstaticas'
import { site } from '../../config/site'

const montar = (nodo: React.ReactNode) => render(<HelmetProvider>{nodo}</HelmetProvider>)

const contenidoDe = (selector: string) =>
  document.head.querySelector(selector)?.getAttribute('content')

describe('MetaDePagina', () => {
  it('pone el título con el sufijo del sitio y la descripción', async () => {
    montar(<MetaDePagina titulo="Cultos" descripcion="Los cultos del año." />)

    await waitFor(() => expect(document.title).toBe('Cultos | Desamparados'))
    expect(contenidoDe('meta[name="description"]')).toBe('Los cultos del año.')
  })

  it('repite título y descripción en Open Graph, que es lo que se lee al pegar el enlace', async () => {
    montar(<MetaDePagina titulo="Cultos" descripcion="Los cultos del año." />)

    await waitFor(() => expect(contenidoDe('meta[property="og:title"]')).toBe('Cultos | Desamparados'))
    expect(contenidoDe('meta[property="og:description"]')).toBe('Los cultos del año.')
  })

  it('la portada se llama por el sitio y no repite el sufijo', async () => {
    montar(<MetaDePagina titulo="Desamparados Málaga" conSufijo={false} descripcion="Una frase." />)

    await waitFor(() => expect(document.title).toBe('Desamparados Málaga'))
  })

  it('sin descripción pone la general del sitio, nunca una vacía', async () => {
    // Una `<meta name="description" content="">` es peor que ninguna: le dice al
    // buscador que la página no tiene descripción. Pasa cuando el subtítulo de
    // una página del CMS está en blanco. Y heredar la de index.html ya no se
    // puede: se quita al arrancar para que no salga repetida.
    montar(<MetaDePagina titulo="Sin descripción" descripcion="  " />)

    await waitFor(() => expect(document.title).toBe('Sin descripción | Desamparados'))
    expect(contenidoDe('meta[name="description"]')).toBe(site.descripcion)
    expect(contenidoDe('meta[property="og:description"]')).toBe(site.descripcion)
  })

  it('con las etiquetas de index.html quitadas al arrancar, cada una sale una sola vez', async () => {
    // React 19 añade las de cada página al final del <head> sin mirar las que ya
    // había: sin quitarlas, la general salía primero y era la que se leía.
    document.head.insertAdjacentHTML('beforeend', [
      '<meta name="description" content="La general">',
      '<meta property="og:title" content="El sitio">',
      '<meta property="og:description" content="La general">',
      '<meta property="og:site_name" content="El sitio">',
    ].join(''))
    quitarMetaEstaticas()
    montar(<MetaDePagina titulo="Cultos" descripcion="Los cultos del año." />)

    await waitFor(() => expect(contenidoDe('meta[name="description"]')).toBe('Los cultos del año.'))
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[property="og:description"]')).toHaveLength(1)
    // Lo que es igual en todas las páginas se queda: React no lo vuelve a poner.
    expect(document.head.querySelectorAll('meta[property="og:site_name"]')).toHaveLength(1)
    document.head.querySelector('meta[property="og:site_name"]')?.remove()
  })

  it('una página de un solo visitante pide que no se indexe', async () => {
    montar(<MetaDePagina titulo="Tu pedido" sinIndexar />)
    await waitFor(() => expect(contenidoDe('meta[name="robots"]')).toBe('noindex'))
  })
})
