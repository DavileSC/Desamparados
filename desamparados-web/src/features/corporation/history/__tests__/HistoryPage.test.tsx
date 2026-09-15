import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import HistoryPage from '../HistoryPage'
import POR_DEFECTO from '../../../../../../shared/contenido-por-defecto.json'
import type { ContenidoHistoria } from '../../../../lib/api/contenido'

const HISTORIA = POR_DEFECTO.historia as ContenidoHistoria

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

describe('HistoryPage', () => {
  it('cuenta la historia como una cronología: un hito por momento, en orden', async () => {
    responder(HISTORIA)
    renderWithProviders(<HistoryPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Historia' })).toBeInTheDocument()

    const lista = screen.getByRole('list', { name: 'Cronología del Grupo Parroquial' })
    const hitos = within(lista).getAllByRole('listitem')
    expect(hitos).toHaveLength(HISTORIA.hitos.length)
    hitos.forEach((hito, indice) => {
      expect(within(hito).getByRole('heading', { level: 2, name: HISTORIA.hitos[indice].titulo })).toBeInTheDocument()
      expect(within(hito).getByText(HISTORIA.hitos[indice].periodo)).toBeInTheDocument()
    })
  })

  it('el índice de la cabecera lleva a cada hito', async () => {
    responder(HISTORIA)
    renderWithProviders(<HistoryPage />)
    await screen.findByRole('heading', { level: 1, name: 'Historia' })

    const indice = screen.getByRole('navigation', { name: 'Momentos de la historia' })
    const enlaces = within(indice).getAllByRole('link')
    expect(enlaces).toHaveLength(HISTORIA.hitos.length)
    enlaces.forEach((enlace, i) => {
      expect(enlace).toHaveAttribute('href', `#hito-${i + 1}`)
      expect(document.getElementById(`hito-${i + 1}`)).toBeInTheDocument()
    })
  })

  it('las fotos van dentro de su hito y la de fondo no se anuncia', async () => {
    responder(HISTORIA)
    renderWithProviders(<HistoryPage />)
    await screen.findByRole('heading', { level: 1, name: 'Historia' })

    const conFoto = HISTORIA.hitos.filter((hito) => hito.foto.url !== '')
    expect(conFoto.length).toBeGreaterThan(0)
    for (const hito of conFoto) {
      expect(screen.getByRole('img', { name: hito.foto.alt })).toBeInTheDocument()
    }
    // La foto velada de fondo es decorativa: ni alt ni papel de imagen.
    expect(screen.getAllByRole('img')).toHaveLength(conFoto.length)
    expect(document.querySelector('img[alt=""]')).toHaveAttribute('src', HISTORIA.fondo.url)
  })

  it('cierra con el enlace a Órganos de Gobierno', async () => {
    responder(HISTORIA)
    renderWithProviders(<HistoryPage />)

    expect(await screen.findByRole('link', { name: /Órganos de Gobierno/ })).toHaveAttribute(
      'href',
      '/corporacion/historia/organos-de-gobierno',
    )
  })

  it('enseña lo que viene del CMS: otros hitos, párrafos partidos y sin foto de fondo', async () => {
    responder({
      ...HISTORIA,
      fondo: { url: '' },
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
    })
    renderWithProviders(<HistoryPage />)

    expect(await screen.findByRole('heading', { level: 2, name: 'Se funda el grupo' })).toBeInTheDocument()
    expect(screen.queryByText('La devoción crece en la parroquia')).not.toBeInTheDocument()
    expect(screen.getByText('Primer párrafo del relato.')).toBeInTheDocument()
    expect(screen.getByText('Segundo párrafo del relato.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('img[alt=""]')).toBeNull()
  })

  it('mientras el servidor no contesta, enseña la historia de siempre', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
    renderWithProviders(<HistoryPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Historia' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: HISTORIA.hitos[0].titulo })).toBeInTheDocument()
  })
})
