import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { renderWithProviders } from '../../../test/test-utils'
import PaginaDeBloquesPublica from '../PaginaDeBloquesPublica'

afterEach(() => { vi.unstubAllGlobals() })

describe('PaginaDeBloquesPublica', () => {
  // Con la API caída, la cabecera a sangre se quedaba en huesos sin ningún
  // encabezado: el lector de pantalla no sabía en qué página estaba.
  it('si la página no carga, su título del catálogo sigue siendo el h1, sobre la banda quieta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Caído' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    renderWithProviders(<HelmetProvider><PaginaDeBloquesPublica slug="parroquia" /></HelmetProvider>, { ruta: '/parroquia' })

    expect(await screen.findByRole('button', { name: /volver a intentar/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Parroquia' })).toBeInTheDocument()
  })

  // Patrimonio (26-11-2026): con un carrusel, la sección no existía aún cuando
  // llegaba el contenido (la página esperaba al bloque, que se descarga aparte)
  // y /sabado-de-pasion/patrimonio#enseres se quedaba arriba.
  it('baja al ancla aunque su bloque se descargue aparte y llegue después', async () => {
    const bajar = vi.fn()
    Element.prototype.scrollIntoView = bajar
    const pagina = {
      cabecera: { titulo: 'Patrimonio', subtitulo: '', foto: '', fotoAlt: '', encuadre: 50 },
      bloques: [
        { tipo: 'texto', titulo: 'El trono', html: '<p>El trono.</p>' },
        {
          tipo: 'carrusel', titulo: 'Enseres', presentacion: { ancla: 'enseres' },
          piezas: [{ familia: 'Insignias', titulo: 'Cruz de guía', texto: 'Abre el cortejo.', foto: { url: '', alt: '', pie: '' }, datos: [] }],
        },
      ],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(pagina), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    renderWithProviders(<HelmetProvider><PaginaDeBloquesPublica slug="patrimonio" /></HelmetProvider>, { ruta: '/sabado-de-pasion/patrimonio#enseres', modulos: ['paginas-propias'] })

    await waitFor(() => expect(bajar).toHaveBeenCalled())
    expect(bajar.mock.contexts[0]).toHaveProperty('id', 'enseres')
  })
})
