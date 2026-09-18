import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import TitularPage from '../TitularPage'

/**
 * La Titular dejó de tener documento propio: es una página de bloques, y su
 * galería es un bloque más. Se comprueba lo mismo que antes —que las fotos y el
 * texto salen del CMS y no del código—, sobre la forma nueva.
 */

const cabecera = {
  titulo: 'Sagrada Titular',
  subtitulo: 'Nuestra Señora de los Desamparados',
  foto: '',
  fotoAlt: '',
}

const GALERIA = {
  tipo: 'galeria',
  titulo: '',
  medios: [
    { tipo: 'foto', url: '/storage/public/camarin.webp', portada: '', alt: 'La Virgen en su camarín', pie: 'Camarín' },
    { tipo: 'video', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', portada: '/storage/public/salida.webp', alt: 'Salida de 2026', pie: '' },
  ],
}

const ACCESOS = {
  tipo: 'tarjetas',
  titulo: '',
  tarjetas: [
    { titulo: 'Desamparados', descripcion: 'Historia y devoción.', enlace: '/sagrada-titular/desamparados' },
    { titulo: 'Ajuar', descripcion: 'Manto, corona y joyas.', enlace: '/sagrada-titular/ajuar' },
  ],
}

const contenido = {
  cabecera,
  bloques: [
    { tipo: 'texto', titulo: '', html: '<p>Imágenes de nuestra Amantísima Titular.</p>' },
    GALERIA,
    ACCESOS,
  ],
}

function responder(datos: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } },
  ))))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('TitularPage', () => {
  it('enseña la galería que viene del CMS, no unas fotos escritas en el código', async () => {
    responder(contenido)
    renderWithProviders(<TitularPage />)

    expect(await screen.findByAltText('La Virgen en su camarín')).toBeInTheDocument()
    expect(screen.getByAltText('Salida de 2026')).toBeInTheDocument()
    expect(screen.getByText('Camarín')).toBeInTheDocument()
  })

  it('el texto de presentación también sale del CMS', async () => {
    responder(contenido)
    renderWithProviders(<TitularPage />)

    expect(await screen.findByText('Imágenes de nuestra Amantísima Titular.')).toBeInTheDocument()
  })

  it('sin bloque de galería la página sigue en pie, solo que sin pase de fotos', async () => {
    responder({ cabecera, bloques: [ACCESOS] })
    renderWithProviders(<TitularPage />)

    // Los enlaces a Desamparados y Ajuar no dependen de la galería.
    expect(await screen.findByRole('link', { name: /desamparados/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /ampliar/i })).not.toBeInTheDocument()
    })
  })
})
