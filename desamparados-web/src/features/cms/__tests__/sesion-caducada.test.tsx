import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TemaCmsProvider } from '../../../app/temaCms'
import VentanaSesionCaducada from '../../../app/VentanaSesionCaducada'
import ExigeRol from '../../../routes/ExigeRol'
import NoticiaEditPage from '../NoticiaEditPage'
import { useAuthStore, type AuthUser } from '../../altas/auth/store'

// Fija lo que pasa cuando la sesión del CMS caduca a media edición (8 h fijas
// en el servidor): antes el 401 vaciaba la sesión, ExigeRol mandaba al acceso
// y la noticia que se estaba escribiendo se perdía entera al pulsar Guardar.
// Ahora la pantalla sigue montada, se vuelve a entrar en una ventana y se
// guarda con el texto intacto. Además, lo sucio queda en sessionStorage.

const admin: AuthUser = { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms' }
const noticia = {
  id: 7, slug: 'apertura', titulo: 'Apertura del curso', extracto: 'Abre el curso.', contenido: '<p>Texto</p>',
  imagenUrl: null, visible: false, fecha: '2026-08-26T00:00:00.000Z',
}
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  sessionStorage.clear()
  useAuthStore.setState({ status: 'listo', cms: admin, hermano: null, cmsCaducada: false })
})
afterEach(() => { vi.unstubAllGlobals() })

function montar({ caducada = false } = {}) {
  let sesionViva = !caducada
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url)
    if (u.includes('/auth/me')) return Promise.resolve(json({ cms: sesionViva ? admin : null, hermano: null }))
    if (u.includes('/auth/login')) { sesionViva = true; return Promise.resolve(json({ status: 'OK', user: admin })) }
    if (init?.method === 'PUT') return Promise.resolve(sesionViva ? json({ ...noticia, ...JSON.parse(String(init.body)) }) : json({ error: 'Token expirado' }, 401))
    return Promise.resolve(json(noticia))
  })
  vi.stubGlobal('fetch', simulado)
  const router = createMemoryRouter(
    [
      { path: '/cms/acceso', element: <p>pantalla de acceso</p> },
      { path: '/cms/noticias', element: <h1>Archivo editorial</h1> },
      { path: '/cms/noticias/:id/editar', element: <ExigeRol roles={['ADMIN']}><NoticiaEditPage /><VentanaSesionCaducada /></ExigeRol> },
    ],
    { initialEntries: ['/cms/noticias/7/editar'] },
  )
  const vista = render(<QueryClientProvider client={new QueryClient()}><HelmetProvider><TemaCmsProvider><RouterProvider router={router} /></TemaCmsProvider></HelmetProvider></QueryClientProvider>)
  return {
    simulado,
    caducar: () => { sesionViva = false },
    desmontar: () => vista.unmount(),
  }
}

async function cambiarTitulo(user: ReturnType<typeof userEvent.setup>, texto: string) {
  const titulo = await screen.findByDisplayValue('Apertura del curso')
  await user.type(titulo, texto)
}

describe('la sesión del CMS caduca a media edición', () => {
  it('no se pierde lo escrito: se vuelve a entrar en una ventana y se guarda', async () => {
    const user = userEvent.setup()
    const { caducar, simulado } = montar()
    await cambiarTitulo(user, ' y del año')
    caducar()

    await user.click(screen.getByRole('button', { name: 'Publicar' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publicar' }))

    // La ventana para volver a entrar, con la pantalla de edición detrás.
    const ventana = await screen.findByRole('dialog', { name: 'Tu sesión ha caducado' })
    expect(screen.queryByText('pantalla de acceso')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Apertura del curso y del año')).toBeInTheDocument()
    expect(within(ventana).getByLabelText(/email/i)).toHaveValue('admin@cofradia.com')

    await user.type(within(ventana).getByLabelText(/contraseña/i, { selector: 'input' }), 'Desamparados2026')
    await user.click(within(ventana).getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useAuthStore.getState().cmsCaducada).toBe(false)

    // Ya dentro, se vuelve a pulsar y se guarda lo que había.
    await user.click(screen.getByRole('button', { name: 'Publicar' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByRole('heading', { name: 'Archivo editorial' })).toBeInTheDocument()
    const put = simulado.mock.calls.findLast(([, init]) => init?.method === 'PUT') as [string, RequestInit]
    expect(JSON.parse(String(put[1].body)).titulo).toBe('Apertura del curso y del año')
  })

  it('«Salir del CMS» deja la pantalla y lleva al acceso', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Apertura del curso')
    useAuthStore.setState({ cmsCaducada: true })

    const ventana = await screen.findByRole('dialog', { name: 'Tu sesión ha caducado' })
    await user.click(within(ventana).getByRole('button', { name: 'Salir del CMS' }))
    expect(await screen.findByText('pantalla de acceso')).toBeInTheDocument()
  })
})

describe('el borrador de una ficha sin guardar', () => {
  it('se guarda en sessionStorage y se ofrece al volver a abrir la misma ficha', async () => {
    const user = userEvent.setup()
    const primera = montar()
    await cambiarTitulo(user, ' (sin guardar)')
    await waitFor(() => expect(sessionStorage.length).toBe(1))
    primera.desmontar()

    montar()
    const oferta = await screen.findByRole('dialog', { name: 'Quedaron cambios sin guardar' })
    await user.click(within(oferta).getByRole('button', { name: 'Recuperar los cambios' }))
    expect(await screen.findByDisplayValue('Apertura del curso (sin guardar)')).toBeInTheDocument()
  })

  it('«Empezar desde lo guardado» lo tira', async () => {
    const user = userEvent.setup()
    const primera = montar()
    await cambiarTitulo(user, ' (sin guardar)')
    await waitFor(() => expect(sessionStorage.length).toBe(1))
    primera.desmontar()

    montar()
    const oferta = await screen.findByRole('dialog', { name: 'Quedaron cambios sin guardar' })
    await user.click(within(oferta).getByRole('button', { name: 'Empezar desde lo guardado' }))
    expect(await screen.findByDisplayValue('Apertura del curso')).toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
  })

  it('con cambios sin guardar, cerrar la pestaña pide confirmación', async () => {
    const user = userEvent.setup()
    montar()
    const sinCambios = new Event('beforeunload', { cancelable: true })
    await screen.findByDisplayValue('Apertura del curso')
    window.dispatchEvent(sinCambios)
    expect(sinCambios.defaultPrevented).toBe(false)

    await cambiarTitulo(user, ' bis')
    const conCambios = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(conCambios)
    expect(conCambios.defaultPrevented).toBe(true)
  })
})
