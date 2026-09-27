import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import RecorridoPage from '../RecorridoPage'
import POR_DEFECTO from '../../../../../../shared/contenido-por-defecto.json'

/**
 * El recorrido dejó de tener documento propio: es una página de bloques, y sus
 * paradas viven en un bloque de itinerario. Estas pruebas siguen mirando lo
 * mismo que antes —que la página pinta lo que manda el CMS y no algo escrito en
 * el código—, solo que sobre la forma nueva.
 */

// Cada test estampa su propio fetch; sin esto, el mock de uno se colaría en el siguiente.
afterEach(() => {
  vi.unstubAllGlobals()
})

const DE_PARTIDA = POR_DEFECTO.recorrido as unknown as {
  cabecera: { titulo: string; subtitulo: string; foto: string; fotoAlt: string }
  bloques: unknown[]
}

const pagina = (bloques: unknown[]) => ({ cabecera: DE_PARTIDA.cabecera, bloques })

/** Las fotos de los bloques: la de la cabecera va aparte y está siempre. */
const fotosDelContenido = () => screen.queryAllByRole('img').filter((img) => !img.closest('header'))

const responder = (recorrido: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(recorrido), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ),
  )

describe('RecorridoPage', () => {
  it('enseña las paradas que vienen del CMS', async () => {
    responder(pagina([
      { tipo: 'itinerario', titulo: 'Itinerario y horarios aproximados', paradas: [{ hora: '18:15', lugar: 'Plaza nueva' }] },
    ]))
    renderWithProviders(<RecorridoPage />)

    expect(await screen.findByText('Plaza nueva')).toBeInTheDocument()
    expect(screen.getByText('18:15')).toBeInTheDocument()
    expect(fotosDelContenido()).toHaveLength(0)
  })

  it('enseña el plano cuando lo hay', async () => {
    // El plano era un campo propio del recorrido; ahora es un bloque de foto,
    // que es lo que de verdad era: una imagen con su descripción.
    responder(pagina([
      {
        tipo: 'foto', titulo: '',
        url: '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp',
        alt: 'Plano del recorrido', pie: '',
      },
      { tipo: 'itinerario', titulo: 'Itinerario', paradas: [{ hora: '19:00', lugar: 'Plaza de la Marina' }] },
    ]))
    renderWithProviders(<RecorridoPage />)

    expect(await screen.findByRole('img', { name: 'Plano del recorrido' })).toBeInTheDocument()
    expect(screen.getByText('Plaza de la Marina')).toBeInTheDocument()
  })

  it('sin bloque de itinerario no pinta ni la rejilla ni su título', async () => {
    responder(pagina([{ tipo: 'texto', titulo: '', html: '<p>Este año no hay recorrido publicado.</p>' }]))
    renderWithProviders(<RecorridoPage />)

    expect(await screen.findByRole('heading', { name: 'Recorrido' })).toBeInTheDocument()
    // El título del encabezado no cambia entre el itinerario de siempre y la
    // respuesta del CMS, así que ya está en pantalla antes de que la petición
    // resuelva: esperar por él no basta para saber que los bloques ya han
    // llegado. `waitFor` sí espera a que React aplique esa actualización.
    await waitFor(() => {
      expect(screen.queryByText('Itinerario y horarios aproximados')).not.toBeInTheDocument()
    })
  })

  it('una página sin bloques deja la cabecera en pie', async () => {
    responder(pagina([]))
    renderWithProviders(<RecorridoPage />)

    expect(await screen.findByRole('heading', { name: 'Recorrido' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Itinerario y horarios aproximados')).not.toBeInTheDocument()
    })
    expect(fotosDelContenido()).toHaveLength(0)
  })

  it('si la API falla, lo avisa y deja volver a intentarlo, sin enseñar el itinerario de partida', async () => {
    // Se rompe si, sin servidor, se vuelve a enseñar el contenido de partida:
    // un itinerario que no es el guardado pasaría por el de verdad.
    const fetch = vi.fn().mockRejectedValue(new Error('sin red'))
    vi.stubGlobal('fetch', fetch)
    const usuario = userEvent.setup()
    renderWithProviders(<RecorridoPage />)

    expect(await screen.findByText(/No se ha podido cargar esta página/)).toBeInTheDocument()
    expect(screen.queryByText('Salida desde el Templo')).not.toBeInTheDocument()

    fetch.mockResolvedValue(new Response(JSON.stringify(DE_PARTIDA), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await usuario.click(screen.getByRole('button', { name: /volver a intentar/i }))
    expect(await screen.findByText('Salida desde el Templo')).toBeInTheDocument()
  })
})
