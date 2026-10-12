import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import EscenaProcesion from '../EscenaProcesion'
import { responderPortada, textosDePrueba } from './ayudas'

afterEach(() => { vi.unstubAllGlobals() })

describe('EscenaProcesion', () => {
  it('enseña el texto y la foto que vienen del CMS', async () => {
    const textos = textosDePrueba()
    textos.sabadoDePasion.titulo = 'Una noche\ncon Ella'
    textos.sabadoDePasion.imagenUrl = '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp'
    textos.sabadoDePasion.imagenAlt = 'La Virgen por la calle Larios'
    responderPortada(textos)

    renderWithProviders(<EscenaProcesion />)

    const foto = await screen.findByRole('img', { name: 'La Virgen por la calle Larios' })
    expect(foto).toHaveAttribute('src', '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp')
  })

  it('el título conserva el corte a dos líneas', async () => {
    // Hoy es un <br /> dentro del JSX. Guardado como texto solo puede ser un \n,
    // y la única forma de que se vea es white-space: pre-line.
    responderPortada(textosDePrueba())

    renderWithProviders(<EscenaProcesion />)

    const titulo = await screen.findByRole('heading', { name: /camina con nosotros/i })
    expect(titulo).toHaveStyle({ whiteSpace: 'pre-line' })
    expect(titulo.textContent).toContain('\n')
  })

  it('la foto fija de nazarenos de la instalación mantiene los cuatro tamaños', async () => {
    // Si el contenido la nombra (Desamparados la tiene en instalacion/imagenes),
    // se sirve con srcset: sería una pena perder los cuatro tamaños.
    const textos = textosDePrueba()
    textos.sabadoDePasion.imagenUrl = '/images/nazarenos-1280.webp'
    textos.sabadoDePasion.imagenAlt = 'Nazarenos con la bandera blanca'
    responderPortada(textos)

    renderWithProviders(<EscenaProcesion />)

    const foto = await screen.findByRole('img', { name: 'Nazarenos con la bandera blanca' })
    expect(foto).toHaveAttribute('srcset', expect.stringContaining('nazarenos-1920.webp'))
  })

  it('sin foto, o con una que no está, la escena se queda con su fondo: ni icono roto ni el alt flotando', async () => {
    const textos = textosDePrueba()
    textos.sabadoDePasion.imagenUrl = '/images/no-esta-en-esta-instalacion.webp'
    textos.sabadoDePasion.imagenAlt = 'Una foto que no está'
    responderPortada(textos)

    renderWithProviders(<EscenaProcesion />)

    const foto = await screen.findByRole('img', { name: 'Una foto que no está' })
    fireEvent.error(foto)
    expect(screen.queryByRole('img', { name: 'Una foto que no está' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('una foto subida se sirve con sus copias reducidas', async () => {
    const textos = textosDePrueba()
    textos.sabadoDePasion.imagenUrl = '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp'
    // Un alt distinto del de siempre: así el render de respaldo (foto del
    // repositorio, con srcset) no puede casar con la búsqueda, y findByRole
    // espera de verdad a la respuesta simulada en vez de resolver con lo
    // primero que pinta el componente mientras carga.
    textos.sabadoDePasion.imagenAlt = 'Una foto subida desde el CMS'
    responderPortada(textos)

    renderWithProviders(<EscenaProcesion />)

    const foto = await screen.findByRole('img', { name: 'Una foto subida desde el CMS' })
    expect(foto).toHaveAttribute('srcset', expect.stringContaining('ab12cd34ef56ab78cd90ef12ab34cd56-640.webp 640w'))
  })

  it('una foto sin copias se sirve sin srcset', async () => {
    const textos = textosDePrueba()
    textos.sabadoDePasion.imagenUrl = '/storage/public/antigua.jpg'
    textos.sabadoDePasion.imagenAlt = 'Una foto antigua'
    responderPortada(textos)

    renderWithProviders(<EscenaProcesion />)

    const foto = await screen.findByRole('img', { name: 'Una foto antigua' })
    expect(foto).not.toHaveAttribute('srcset')
  })

  it('mientras llegan los textos, sus huesos y no los de partida', async () => {
    let responder!: () => void
    const textos = textosDePrueba()
    textos.sabadoDePasion.titulo = 'El título de esta corporación'
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      responder = () => resolve(new Response(JSON.stringify({ imagenes: [], textos }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })))
    const { container } = renderWithProviders(<EscenaProcesion />)

    const partida = textosDePrueba().sabadoDePasion
    expect(screen.queryByText(partida.ceja)).not.toBeInTheDocument()
    expect(screen.queryByText(partida.enlace)).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-esqueleto-portada]').length).toBe(4)

    responder()
    expect(await screen.findByRole('heading', { name: 'El título de esta corporación' })).toBeInTheDocument()
    expect(container.querySelector('[data-esqueleto-portada]')).toBeNull()
  })
})
