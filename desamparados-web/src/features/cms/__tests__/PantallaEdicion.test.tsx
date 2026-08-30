import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom'
import cmsTheme from '../../../theme/cms'
import PantallaEdicion from '../PantallaEdicion'

/**
 * `AllTheProviders` monta un `BrowserRouter`, que no soporta `useBlocker`, así
 * que este fichero monta su propio router de memoria con un listado al que
 * volver.
 */
function montar(props: Partial<Parameters<typeof PantallaEdicion>[0]> = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/cms/noticias',
        element: <><h1>Archivo editorial</h1><Link to="/cms/noticias/1/editar">Ir a editar</Link></>,
      },
      {
        path: '/cms/noticias/1/editar',
        element: (
          <PantallaEdicion titulo="Editar noticia" nombre="Apertura del curso cofrade" sucio={false} volverA="/cms/noticias" onGuardar={() => {}} {...props}>
            <p>Campos del formulario</p>
          </PantallaEdicion>
        ),
      },
    ],
    { initialEntries: ['/cms/noticias/1/editar'] },
  )
  return {
    ...render(<ThemeProvider theme={cmsTheme}><RouterProvider router={router} /></ThemeProvider>),
    router,
  }
}

describe('PantallaEdicion', () => {
  it('enseña qué se está editando y sus campos', () => {
    montar()
    expect(screen.getByRole('heading', { name: /editar noticia/i })).toBeInTheDocument()
    expect(screen.getByText('Apertura del curso cofrade')).toBeInTheDocument()
    expect(screen.getByText('Campos del formulario')).toBeInTheDocument()
    // El listado no se ve: es justo lo que se venía a arreglar.
    expect(screen.queryByRole('heading', { name: /archivo editorial/i })).not.toBeInTheDocument()
  })

  it('guardar pide confirmación y nombra la ficha', async () => {
    const user = userEvent.setup()
    const guardar = vi.fn()
    montar({ sucio: true, onGuardar: guardar })
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Apertura del curso cofrade')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(guardar).toHaveBeenCalledOnce()
  })

  it('salir con cambios avisa antes de perderlos', async () => {
    const user = userEvent.setup()
    montar({ sucio: true })
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/se van a perder/i)
    // Mientras no se confirme, seguimos en la edición.
    expect(screen.getByText('Campos del formulario')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salir sin guardar' }))
    expect(await screen.findByRole('heading', { name: /archivo editorial/i })).toBeInTheDocument()
  })

  it('mientras guarda no pregunta: esos cambios son los que se están guardando', async () => {
    // La página navega al listado en cuanto el servidor responde, y en ese
    // momento el formulario sigue «sucio»: sin esto, guardar acababa con el
    // aviso de que se iban a perder los cambios recién guardados.
    const { router } = montar({ sucio: true, guardando: true })
    await act(async () => { await router.navigate('/cms/noticias') })
    expect(await screen.findByRole('heading', { name: /archivo editorial/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin cambios, cancelar sale directo', async () => {
    // Avisar de que se pierden cambios que no existen enseña a ignorar los avisos.
    const user = userEvent.setup()
    montar({ sucio: false })
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('heading', { name: /archivo editorial/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
