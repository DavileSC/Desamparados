import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import NewsAdminPage from '../NewsAdminPage'

const noticia = {
  id: 7, slug: 'apertura-curso-cofrade', titulo: 'Apertura del curso cofrade 2026-2027',
  extracto: 'El Grupo Parroquial abre el nuevo curso.', contenido: '<p>Texto</p>',
  imagenUrl: null, visible: true, fecha: '2026-08-26T00:00:00.000Z',
}

function responder(items: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: items, meta: { total: items.length, page: 1, limit: 50, lastPage: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('NewsAdminPage', () => {
  it('antes de borrar pregunta, y dice qué se va a borrar', async () => {
    // Hasta ahora era un window.confirm: no decía de qué noticia hablaba.
    const user = userEvent.setup()
    responder([noticia])
    renderWithProviders(<NewsAdminPage />)
    await user.click(await screen.findByRole('button', { name: /eliminar apertura/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Apertura del curso cofrade 2026-2027')
  })

  it('quien cancela no borra nada', async () => {
    const user = userEvent.setup()
    responder([noticia])
    renderWithProviders(<NewsAdminPage />)
    await user.click(await screen.findByRole('button', { name: /eliminar apertura/i }))

    const llamadas = vi.fn()
    vi.stubGlobal('fetch', llamadas)
    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(llamadas).not.toHaveBeenCalled()
    // El diálogo de MUI se va con una transición: sigue en el DOM un instante.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('editar lleva a la pantalla de la noticia, no al formulario de abajo', async () => {
    responder([noticia])
    renderWithProviders(<NewsAdminPage />)
    const editar = await screen.findByRole('link', { name: /editar apertura/i })
    expect(editar).toHaveAttribute('href', '/cms/noticias/7/editar')
  })
})
