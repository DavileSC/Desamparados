import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import HistoriaPage from '../HistoriaPage'
import POR_DEFECTO from '../../../../../../shared/contenido-por-defecto.json'
import type { BloqueCronologia, PaginaDeBloques } from '../../../../lib/api/contenido'

/**
 * Historia se edita como una página de bloques, pero conserva su maquetación:
 * se comprueba lo mismo que cuando tenía documento propio —la cronología, el
 * índice, las fotos y el cierre—, sobre la forma nueva.
 */
const HISTORIA = POR_DEFECTO.historia as PaginaDeBloques
const HITOS = (HISTORIA.bloques.find((b) => b.tipo === 'cronologia') as BloqueCronologia).hitos

// Cada test estampa su propio fetch; sin esto, el mock de uno se colaría en el siguiente.
afterEach(() => {
  vi.unstubAllGlobals()
})

const responder = (historia: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(historia), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ),
  )

describe('HistoriaPage', () => {
  it('cuenta la historia como una cronología: un hito por momento, en orden', async () => {
    responder(HISTORIA)
    renderWithProviders(<HistoriaPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Historia' })).toBeInTheDocument()
    expect(screen.getByText('Corporación · Historia')).toBeInTheDocument()

    const lista = screen.getByRole('list', { name: 'Cronología' })
    const hitos = within(lista).getAllByRole('listitem')
    expect(hitos).toHaveLength(HITOS.length)
    hitos.forEach((hito, indice) => {
      expect(within(hito).getByRole('heading', { level: 3, name: HITOS[indice].titulo })).toBeInTheDocument()
      expect(within(hito).getByText(HITOS[indice].periodo)).toBeInTheDocument()
    })
  })

  it('el índice de la cabecera lleva a cada hito', async () => {
    responder(HISTORIA)
    renderWithProviders(<HistoriaPage />)
    await screen.findByRole('heading', { level: 1, name: 'Historia' })

    const indice = screen.getByRole('navigation', { name: 'Momentos de la historia' })
    const enlaces = within(indice).getAllByRole('link')
    expect(enlaces).toHaveLength(HITOS.length)
    enlaces.forEach((enlace, i) => {
      expect(enlace).toHaveAttribute('href', `#hito-${i + 1}`)
      expect(document.getElementById(`hito-${i + 1}`)).toBeInTheDocument()
    })
  })

  it('las fotos van dentro de su hito y la de fondo no se anuncia', async () => {
    responder(HISTORIA)
    renderWithProviders(<HistoriaPage />)
    await screen.findByRole('heading', { level: 1, name: 'Historia' })

    const conFoto = HITOS.filter((hito) => hito.foto.url !== '')
    expect(conFoto.length).toBeGreaterThan(0)
    for (const hito of conFoto) {
      expect(screen.getByRole('img', { name: hito.foto.alt })).toBeInTheDocument()
    }
    // La foto velada de fondo es decorativa: ni alt ni papel de imagen, aunque
    // la cabecera guarde una descripción (el esquema la pide en cuanto hay foto).
    expect(screen.getAllByRole('img')).toHaveLength(conFoto.length)
    expect(document.querySelector('img[alt=""]')).toHaveAttribute('src', HISTORIA.cabecera.foto)
  })

  it('cierra con la llamada a Órganos de Gobierno, con el aspecto de siempre', async () => {
    responder(HISTORIA)
    renderWithProviders(<HistoriaPage />)

    expect(await screen.findByRole('link', { name: /Órganos de Gobierno/ })).toHaveAttribute(
      'href',
      '/historia/organos-de-gobierno',
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Quién gobierna hoy el Grupo Parroquial' })).toBeInTheDocument()
    expect(screen.getByText('Seguir leyendo')).toBeInTheDocument()
  })

  it('enseña lo que viene del CMS: otros hitos, párrafos partidos, otros bloques y sin foto de fondo', async () => {
    responder({
      cabecera: { ...HISTORIA.cabecera, foto: '', fotoAlt: '' },
      bloques: [
        {
          tipo: 'cronologia',
          titulo: '',
          hitos: [
            {
              periodo: '1954',
              etiqueta: 'Fundación',
              titulo: 'Se funda el grupo',
              relato: 'Primer párrafo del relato.\n\nSegundo párrafo del relato.',
              foto: { url: '', alt: '', pie: '' },
              tono: 'ninguno',
            },
          ],
        },
        { tipo: 'texto', titulo: 'Una nota', html: '<p>Un bloque cualquiera añadido desde el CMS.</p>' },
      ],
    })
    renderWithProviders(<HistoriaPage />)

    expect(await screen.findByRole('heading', { level: 3, name: 'Se funda el grupo' })).toBeInTheDocument()
    expect(screen.queryByText('La devoción crece en la parroquia')).not.toBeInTheDocument()
    expect(screen.getByText('Primer párrafo del relato.')).toBeInTheDocument()
    expect(screen.getByText('Segundo párrafo del relato.')).toBeInTheDocument()
    expect(screen.getByText('Un bloque cualquiera añadido desde el CMS.')).toBeInTheDocument()
    // Sin llamada, no hay cierre.
    expect(screen.queryByRole('link', { name: /Órganos de Gobierno/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('img[alt=""]')).toBeNull()
  })

  it('sin cronología no hay índice en la cabecera', async () => {
    responder({ cabecera: HISTORIA.cabecera, bloques: [] })
    renderWithProviders(<HistoriaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Historia' })
    await vi.waitFor(() => expect(screen.queryByRole('navigation', { name: 'Momentos de la historia' })).not.toBeInTheDocument())
  })

  it('mientras el servidor no contesta, enseña la historia de siempre', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
    renderWithProviders(<HistoriaPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Historia' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: HITOS[0].titulo })).toBeInTheDocument()
  })
})
