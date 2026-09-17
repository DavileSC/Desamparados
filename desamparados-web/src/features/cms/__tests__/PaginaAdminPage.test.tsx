import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import PaginaAdminPage from '../PaginaAdminPage'

const contenido = {
  cabecera: { titulo: 'Corporación', subtitulo: 'Grupo Parroquial.', foto: '', fotoAlt: '' },
  bloques: [
    { tipo: 'texto', titulo: '', html: '<p>Un párrafo</p>' },
    { tipo: 'tarjetas', titulo: 'Explora la sección', tarjetas: [{ titulo: 'Historia', descripcion: 'Orígenes.', enlace: '/corporacion/historia' }] },
  ],
}

afterEach(() => { vi.unstubAllGlobals() })

/**
 * PantallaEdicion usa useBlocker, que exige un data router.
 *
 * `respuestaPut` deja simular un 400 del servidor (Crítico 2 del fix round 1):
 * algo que el cliente no comprobó, pero que el servidor sí rechaza.
 */
function montar(respuestaPut?: { status: number; cuerpo: unknown }) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET'
    llamadas.push({ url, metodo, cuerpo: init?.body ? JSON.parse(String(init.body)) : null })
    if (metodo === 'PUT' && respuestaPut) {
      return Promise.resolve(new Response(
        JSON.stringify(respuestaPut.cuerpo),
        { status: respuestaPut.status, headers: { 'Content-Type': 'application/json' } },
      ))
    }
    return Promise.resolve(new Response(
      JSON.stringify(metodo === 'PUT' ? { message: 'Guardado', data: contenido } : contenido),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
  }))
  const router = createMemoryRouter(
    [{ path: '/cms', element: <h1>Panel</h1> }, { path: '/cms/paginas/:slug', element: <PaginaAdminPage /> }],
    { initialEntries: ['/cms/paginas/corporacion'] },
  )
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
  return llamadas
}

const guardar = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
}

describe('PaginaAdminPage', () => {
  it('carga la cabecera y los bloques que ya hay', async () => {
    montar()
    expect(await screen.findByDisplayValue('Corporación')).toBeInTheDocument()
    expect(screen.getByText(/Texto/)).toBeInTheDocument()
    expect(screen.getByText(/Tarjetas/)).toBeInTheDocument()
  })

  it('la cabecera no se puede quitar', async () => {
    montar()
    await screen.findByDisplayValue('Corporación')
    const cabecera = screen.getByDisplayValue('Corporación').closest('.MuiPaper-root') as HTMLElement
    expect(within(cabecera).queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument()
  })

  it('se añade un bloque eligiendo su tipo', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /añadir bloque/i }))
    await user.click(await screen.findByRole('menuitem', { name: /foto/i }))

    expect(await screen.findByText(/Posición 3 de 3/)).toBeInTheDocument()
  })

  it('se quita un bloque', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Corporación')
    expect(screen.getByText('Bloques (2)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /quitar el bloque 1/i }))

    // El contador y la desaparición del bloque: comprobar que no existe un
    // texto que tampoco existía antes no prueba nada.
    expect(screen.getByText('Bloques (1)')).toBeInTheDocument()
    expect(screen.queryByText('Texto')).not.toBeInTheDocument()
    expect(screen.getByText('Tarjetas')).toBeInTheDocument()
  })

  it('se reordena y se guarda en el orden nuevo', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /bajar el bloque 1/i }))
    await guardar(user)

    await waitFor(() => {
      const envio = llamadas.find((l) => l.metodo === 'PUT')
      expect(envio!.url).toContain('/contenido/corporacion')
      const bloques = (envio!.cuerpo as { datos: { bloques: { tipo: string }[] } }).datos.bloques
      expect(bloques.map((b) => b.tipo)).toEqual(['tarjetas', 'texto'])
    })
  })

  it('avisa si la cabecera se queda sin título, y no manda nada', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await user.clear(await screen.findByDisplayValue('Corporación'))
    await guardar(user)

    expect(await screen.findByText(/sin título/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })

  it('avisa de qué bloque falla si se guarda con una foto recién añadida (vacía), y no manda nada; y lo despliega', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /añadir bloque/i }))
    await user.click(await screen.findByRole('menuitem', { name: /foto/i }))
    await guardar(user)

    // Nombra el bloque por su posición y su tipo: plegado, es la única forma
    // de saber cuál de todos es.
    expect(await screen.findByText(/el bloque 3 \(foto\) no tiene foto/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)

    // Y lo despliega: el campo culpable tiene que quedar a la vista, no solo
    // nombrado en el aviso. Antes de guardar los tres bloques están plegados
    // (unmountOnExit), así que si aparece exactamente uno es el que falló.
    expect(screen.getAllByLabelText(/título de sección/i)).toHaveLength(1)
  })

  it('si el servidor rechaza algo que el cliente no vio, enseña el bloque y el motivo en vez del aviso genérico', async () => {
    const user = userEvent.setup()
    const llamadas = montar({
      status: 400,
      cuerpo: {
        status: 'error',
        message: 'Error de validación',
        errors: [{ field: 'bloques.1', message: 'Debe ser una ruta interna, sin salir del sitio' }],
      },
    })
    await screen.findByDisplayValue('Corporación')

    // Sin tocar nada, guardar no manda ningún PUT (documento igual al
    // cargado): un cambio inocuo en la cabecera lo deja «sucio» sin tocar el
    // orden ni la validez de ningún bloque. El bloque 2 (tarjetas) sigue
    // siendo válido para el cliente: la comprobación local no mira el patrón
    // del enlace, así que esto sí llega a mandarse.
    await user.type(screen.getByRole('textbox', { name: 'Subtítulo' }), ' extra')
    await guardar(user)

    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true))
    expect(await screen.findByText(/el bloque 2 \(tarjetas\)/i)).toBeInTheDocument()
    expect(screen.getByText(/sin salir del sitio/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Error de validación$/)).not.toBeInTheDocument()
  })

  it('la vista previa abre la página pública en otra pestaña', async () => {
    montar()
    await screen.findByDisplayValue('Corporación')

    const previa = screen.getByRole('link', { name: /vista previa/i })
    expect(previa).toHaveAttribute('href', '/corporacion')
    expect(previa).toHaveAttribute('target', '_blank')
    expect(previa).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
