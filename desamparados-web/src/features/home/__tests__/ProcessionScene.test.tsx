import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ProcessionScene from '../ProcessionScene'
import { responderPortada, textosDePrueba } from './ayudas'

afterEach(() => { vi.unstubAllGlobals() })

describe('ProcessionScene', () => {
  it('enseña el texto y la foto que vienen del CMS', async () => {
    const textos = textosDePrueba()
    textos.sabadoDePasion.titulo = 'Una noche\ncon Ella'
    textos.sabadoDePasion.imagenUrl = '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp'
    textos.sabadoDePasion.imagenAlt = 'La Virgen por la calle Larios'
    responderPortada(textos)

    renderWithProviders(<ProcessionScene />)

    const foto = await screen.findByRole('img', { name: 'La Virgen por la calle Larios' })
    expect(foto).toHaveAttribute('src', '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp')
  })

  it('el título conserva el corte a dos líneas', async () => {
    // Hoy es un <br /> dentro del JSX. Guardado como texto solo puede ser un \n,
    // y la única forma de que se vea es white-space: pre-line.
    responderPortada(textosDePrueba())

    renderWithProviders(<ProcessionScene />)

    const titulo = await screen.findByRole('heading', { name: /camina con nosotros/i })
    expect(titulo).toHaveStyle({ whiteSpace: 'pre-line' })
    expect(titulo.textContent).toContain('\n')
  })

  it('con la foto de siempre mantiene los cuatro tamaños', async () => {
    // Mientras nadie suba otra, la del repositorio sigue sirviéndose con srcset:
    // sería una pena perder los cuatro tamaños sin que nadie haya cambiado nada.
    responderPortada(textosDePrueba())

    renderWithProviders(<ProcessionScene />)

    const foto = await screen.findByRole('img', { name: /nazarenos/i })
    expect(foto).toHaveAttribute('srcset', expect.stringContaining('nazarenos-1920.webp'))
  })

  it('una foto subida se sirve sin srcset', async () => {
    const textos = textosDePrueba()
    textos.sabadoDePasion.imagenUrl = '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp'
    // Un alt distinto del de siempre: así el render de respaldo (foto del
    // repositorio, con srcset) no puede casar con la búsqueda, y findByRole
    // espera de verdad a la respuesta simulada en vez de resolver con lo
    // primero que pinta el componente mientras carga.
    textos.sabadoDePasion.imagenAlt = 'Una foto subida desde el CMS'
    responderPortada(textos)

    renderWithProviders(<ProcessionScene />)

    const foto = await screen.findByRole('img', { name: 'Una foto subida desde el CMS' })
    expect(foto).not.toHaveAttribute('srcset')
  })
})
