import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import MetaDePagina from '../MetaDePagina'

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

  it('sin descripción no escribe una vacía: se hereda la de index.html', async () => {
    // Una `<meta name="description" content="">` es peor que ninguna: le dice al
    // buscador que la página no tiene descripción, en vez de dejarle usar la del
    // documento. Pasa cuando el subtítulo de una página del CMS está en blanco.
    montar(<MetaDePagina titulo="Sin descripción" />)

    await waitFor(() => expect(document.title).toBe('Sin descripción | Desamparados'))
    expect(contenidoDe('meta[name="description"]')).toBeUndefined()
    expect(contenidoDe('meta[property="og:description"]')).toBeUndefined()
  })
})
