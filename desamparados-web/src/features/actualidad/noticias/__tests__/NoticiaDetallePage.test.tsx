// Fija que una noticia que no existe da la página de no encontrada (con su
// noindex) y no un «Volver a intentar» que nunca llegará a nada; y que un
// fallo de verdad del servidor sí sigue ofreciendo reintentar.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../../test/test-utils'
import NoticiaDetallePage from '../NoticiaDetallePage'
import { stubFetchPublico } from '../../../../test/fetchPublico'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

function abrir(status: number) {
  stubFetchPublico(vi.fn().mockImplementation((entrada: RequestInfo | URL) =>
    Promise.resolve(String(entrada).includes('/news/')
      ? json({ message: status === 404 ? 'Noticia no encontrada' : 'Error interno' }, status)
      : json({}, 404))))
  renderWithProviders(
    <Routes><Route path="/noticias/:slug" element={<NoticiaDetallePage />} /></Routes>,
    { ruta: '/noticias/no-existe' },
  )
}

afterEach(() => { vi.unstubAllGlobals() })

describe('NoticiaDetallePage ante una dirección que no existe', () => {
  it('pinta la página de no encontrada, sin «Volver a intentar»', async () => {
    abrir(404)
    expect(await screen.findByRole('heading', { level: 1, name: /no está en el recorrido/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /volver a intentar/i })).not.toBeInTheDocument()
  })

  it('un fallo del servidor sí deja volver a intentarlo', async () => {
    abrir(500)
    expect(await screen.findByRole('button', { name: /volver a intentar/i })).toBeInTheDocument()
  })
})
