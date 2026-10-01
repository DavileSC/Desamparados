import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../../theme/cms'
import { renderWithProviders } from '../../../../test/test-utils'
import EmailsPage from '../EmailsPage'
import EmailEditPage from '../EmailEditPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const ORIGINAL = { asunto: 'Nuestro pésame por {{difunto}}', titulo: 'Nuestro más sentido pésame', cuerpo: 'Estimada familia:\n\nPor **{{difunto}}**.', despedida: 'Descanse en paz.' }
const PESAME = {
  clave: 'pesame', grupo: 'Difuntos', nombre: 'Pésame a la familia', descripcion: 'A la familia de un hermano difunto.', libre: false,
  campos: [{ clave: 'difunto', ayuda: 'Nombre del difunto', ejemplo: 'José García' }], bloques: [], original: ORIGINAL,
  plantillas: [{ id: 5, nombre: 'Pésame breve', asunto: 'Con ustedes', enUso: false, autorNombre: 'Ana', updatedAt: '2026-10-01T10:00:00.000Z' }],
}
const PAPELETA = {
  clave: 'papeleta', grupo: 'Procesión', nombre: 'Papeleta de una salida', descripcion: 'Al recoger la papeleta.', libre: false,
  campos: [], bloques: [{ clave: 'papeleta', ayuda: 'La papeleta', obligatorio: true }], original: { ...ORIGINAL, cuerpo: '[[papeleta]]' }, plantillas: [],
}
const CATALOGO = { comunes: [{ clave: 'grupo', ayuda: 'El nombre del Grupo' }], usos: [PESAME, PAPELETA] }

function servidor(catalogo: unknown = CATALOGO) {
  const llamadas: { url: string; metodo: string; cuerpo?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const u = String(url)
    const metodo = init.method ?? 'GET'
    const cuerpo = init.body ? JSON.parse(String(init.body)) : undefined
    llamadas.push({ url: u, metodo, cuerpo })
    if (u.endsWith('/vista-previa')) {
      const problemas = String(cuerpo.cuerpo).includes('{{difunta}}') ? ['Este correo no tiene el campo {{difunta}}.'] : []
      return Promise.resolve(json({ asunto: 'Nuestro pésame por José García', html: '<p>vista</p>', problemas }))
    }
    if (u.endsWith('/usar')) return Promise.resolve(json({ ...CATALOGO, usos: [{ ...PESAME, plantillas: [{ ...PESAME.plantillas[0], enUso: true }] }, PAPELETA] }))
    if (metodo === 'POST' && u.endsWith('/plantillas-correo')) return Promise.resolve(json({ id: 9, ...cuerpo, enUso: false }, 201))
    return Promise.resolve(json(catalogo))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

/** El editor, con un enrutador de datos: la pantalla de edición avisa al salir sin guardar (useBlocker). */
function montarEditor(ruta: string) {
  const router = createMemoryRouter([
    { path: '/cms/emails/:id', element: <EmailEditPage /> },
    { path: '/cms/emails', element: <h1>Lista</h1> },
  ], { initialEntries: [ruta] })
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<HelmetProvider><QueryClientProvider client={cliente}><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></QueryClientProvider></HelmetProvider>)
}

describe('Emails', () => {
  it('agrupa los correos, dice con qué sale cada uno y pone en uso una plantilla', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<EmailsPage />, { ruta: '/cms/emails' })
    const pesame = await screen.findByLabelText('Pésame a la familia')
    expect(within(pesame).getByText('el texto original')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Procesión' })).toBeInTheDocument()
    await user.click(within(pesame).getAllByRole('button', { name: 'Usar' })[0])
    expect(await screen.findByText('«Pésame a la familia» sale ahora con la plantilla «Pésame breve».')).toBeInTheDocument()
    expect(llamadas.find((l) => l.url.endsWith('/usar'))?.cuerpo).toEqual({ uso: 'pesame', id: 5 })
    // La que está en uso no se puede borrar.
    expect(within(screen.getByLabelText('Pésame a la familia')).getByRole('button', { name: 'Borrar' })).toBeDisabled()
  })

  it('una nueva parte del texto original, avisa de un campo que no existe y se guarda', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    montarEditor('/cms/emails/nueva?uso=pesame')
    const texto = await screen.findByLabelText('Texto')
    expect(texto).toHaveValue(ORIGINAL.cuerpo)
    expect(await screen.findByText('Asunto:', { exact: false })).toBeInTheDocument()

    await user.clear(texto)
    await user.type(texto, 'Por {{{{difunta}}')
    expect(await screen.findByText('Este correo no tiene el campo {{difunta}}.', {}, { timeout: 3000 })).toBeInTheDocument()

    await user.clear(texto)
    await user.type(texto, 'Rezamos por ')
    await user.click(screen.getByRole('button', { name: '{{difunto}}' }))
    expect(texto).toHaveValue('Rezamos por {{difunto}}')
    await user.type(screen.getByLabelText(/Nombre de la plantilla/), 'Pésame breve')
    await waitFor(() => expect(screen.queryByText(/no tiene el campo/)).not.toBeInTheDocument(), { timeout: 3000 })
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
    expect(llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/plantillas-correo'))?.cuerpo).toMatchObject({ nombre: 'Pésame breve', uso: 'pesame', cuerpo: 'Rezamos por {{difunto}}' })
  })

  it('los bloques fijos se meten en su propia línea', async () => {
    const user = userEvent.setup()
    servidor()
    montarEditor('/cms/emails/nueva?uso=papeleta')
    const texto = await screen.findByLabelText('Texto')
    await user.clear(texto)
    await user.type(texto, 'Su sitio:')
    await user.click(screen.getByRole('button', { name: '[[papeleta]] *' }))
    expect(texto).toHaveValue('Su sitio:\n\n[[papeleta]]')
  })
})
