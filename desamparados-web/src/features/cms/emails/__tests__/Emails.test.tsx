import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../../theme/cms'
import { renderWithProviders } from '../../../../test/test-utils'
import { crearQueryClientDePruebas } from '../../../../test/queryClient'
import EmailsPage from '../EmailsPage'
import EmailEditPage from '../EmailEditPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const ORIGINAL = {
  asunto: 'Nuestro pésame por {{difunto}}', resumen: '', titulo: 'Nuestro más sentido pésame', despedida: 'Descanse en paz.',
  contenido: [
    { tipo: 'parrafo', trozos: [{ texto: 'Estimada familia:' }] },
    { tipo: 'parrafo', trozos: [{ texto: 'Rezamos por ' }, { texto: '{{difunto}}', negrita: true }, { texto: '.' }] },
  ],
}
const PESAME = {
  clave: 'pesame', grupo: 'Difuntos', nombre: 'Pésame a la familia', descripcion: 'A la familia de un hermano difunto.', libre: false,
  antetitulo: 'Secretaría', firma: 'La Secretaría',
  campos: [{ clave: 'difunto', etiqueta: 'Difunto', ayuda: 'Nombre del difunto', ejemplo: 'José García' }], bloques: [], original: ORIGINAL,
  plantillas: [{ id: 5, nombre: 'Pésame breve', asunto: 'Con ustedes', enUso: false, autorNombre: 'Ana', updatedAt: '2026-10-01T10:00:00.000Z' }],
}
const PAPELETA = {
  clave: 'papeleta', grupo: 'Procesión', nombre: 'Papeleta de una salida', descripcion: 'Al recoger la papeleta.', libre: false,
  antetitulo: 'Estación de penitencia', firma: 'La Secretaría',
  campos: [], bloques: [{ clave: 'papeleta', ayuda: 'La papeleta', obligatorio: true }],
  original: { ...ORIGINAL, contenido: [{ tipo: 'fijo', clave: 'papeleta' }] }, plantillas: [],
}
const CATALOGO = { conCabecera: false, comunes: [{ clave: 'grupo', etiqueta: 'Nombre oficial', ayuda: 'El nombre del Grupo', ejemplo: 'Grupo Parroquial' }], usos: [PESAME, PAPELETA] }

function servidor(catalogo: unknown = CATALOGO) {
  const llamadas: { url: string; metodo: string; cuerpo?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const u = String(url)
    const metodo = init.method ?? 'GET'
    const cuerpo = init.body ? JSON.parse(String(init.body)) : undefined
    llamadas.push({ url: u, metodo, cuerpo })
    if (u.endsWith('/vista-previa')) {
      const problemas = String(cuerpo.asunto).trim() ? [] : ['Falta el asunto.']
      return Promise.resolve(json({ asunto: 'Nuestro pésame por José García', html: '<div data-resumen>Rezamos por José García.</div><p>vista</p>', problemas, avisos: [] }))
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
  render(<HelmetProvider><QueryClientProvider client={crearQueryClientDePruebas()}><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></QueryClientProvider></HelmetProvider>)
}

describe('Emails', () => {
  it('un correo por fila, con cuándo sale y su asunto; «Editar» abre el que sale hoy y las demás plantillas van debajo', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<EmailsPage />, { ruta: '/cms/emails' })
    const pesame = await screen.findByRole('group', { name: 'Pésame a la familia' })
    expect(within(pesame).getByText('A la familia de un hermano difunto.')).toBeInTheDocument()
    // El asunto como lo leerá quien lo recibe, con el ejemplo en vez de {{difunto}}.
    expect(within(pesame).getByText('Nuestro pésame por José García')).toBeInTheDocument()
    expect(within(pesame).getByText('Texto de la web, sin cambiar')).toBeInTheDocument()
    expect(within(pesame).getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/cms/emails/nueva?uso=pesame')
    expect(within(pesame).queryByRole('link', { name: 'Nueva' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Procesión' })).toBeInTheDocument()

    await user.click(within(pesame).getByRole('button', { name: 'Usar esta' }))
    expect(await screen.findByText('«Pésame a la familia» sale ahora con la plantilla «Pésame breve».')).toBeInTheDocument()
    expect(llamadas.find((l) => l.url.endsWith('/usar'))?.cuerpo).toEqual({ uso: 'pesame', id: 5 })
    const ahora = screen.getByRole('group', { name: 'Pésame a la familia' })
    expect(within(ahora).getByText('Plantilla «Pésame breve»')).toBeInTheDocument()
    expect(within(ahora).getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/cms/emails/5')
    // La que está en uso no se borra desde aquí: primero se vuelve al texto de la web o se usa otra.
    expect(within(ahora).queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
    expect(within(ahora).getByRole('button', { name: 'Volver al texto de la web' })).toBeInTheDocument()
  })

  it('una nueva parte del original, escrita sobre la carta, con los datos como pastillas, y se guarda en piezas', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    montarEditor('/cms/emails/nueva?uso=pesame')

    const carta = await screen.findByRole('textbox', { name: 'Texto de la carta' })
    expect(screen.getByRole('heading', { name: 'Editar el correo' })).toBeInTheDocument()
    expect(within(carta).getByText('Estimada familia:')).toBeInTheDocument()
    // El campo se ve con su ejemplo, no como {{difunto}}.
    expect(within(carta).getByText('José García')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Asunto' })).toHaveTextContent('Nuestro pésame por José García')
    expect(screen.getByText('Secretaría')).toBeInTheDocument()

    // Un botón nuevo: sale en la carta y se ajusta en el panel de la derecha.
    await user.click(screen.getByRole('button', { name: /^Botón/ }))
    const loQuePone = await screen.findByLabelText('Lo que pone')
    await user.type(loQuePone, 'Ver la agenda')
    expect(await within(carta).findByText(/Ver la agenda/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nombre de la plantilla/), 'Pésame con botón')
    await waitFor(() => expect(screen.getByText('Hay cambios sin guardar')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
    // Sin ninguna en uso, «Editar» trabaja sobre el texto de la web: al guardar, la plantilla pasa a usarse.
    expect(llamadas.find((l) => l.url.endsWith('/usar'))?.cuerpo).toEqual({ uso: 'pesame', id: 9 })

    const guardada = llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/plantillas-correo'))?.cuerpo
    expect(guardada).toMatchObject({ nombre: 'Pésame con botón', uso: 'pesame', asunto: 'Nuestro pésame por {{difunto}}' })
    expect(guardada?.contenido).toEqual([...ORIGINAL.contenido, { tipo: 'boton', texto: 'Ver la agenda', enlace: '/area-hermano' }])
  })

  it('un dato del panel va donde estaba el cursor: en el asunto, como {{clave}}', async () => {
    const user = userEvent.setup()
    servidor()
    montarEditor('/cms/emails/nueva?uso=pesame')
    const asunto = await screen.findByRole('textbox', { name: 'Asunto' })
    await user.click(asunto)
    // «Nuestro nombre» empieza cerrada; las formas del nombre se enseñan tal cual, sin etiqueta.
    await user.click(screen.getByRole('button', { name: 'Nuestro nombre' }))
    await user.click(await screen.findByRole('button', { name: /Nombre oficial/ }))
    expect(within(asunto).getByText('Grupo Parroquial')).toBeInTheDocument()
  })

  it('lo que pone la web: dice que está y que no se quita', async () => {
    servidor()
    montarEditor('/cms/emails/nueva?uso=papeleta')
    const panel = await screen.findByRole('complementary', { name: 'Piezas y datos del correo' })
    expect(within(panel).getByText('La papeleta')).toBeInTheDocument()
    expect(within(panel).getByText('En el correo · no se quita')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Ponerlo' })).not.toBeInTheDocument()
  })

  it('revisar: la bandeja con el asunto y el resumen del correo de verdad, y el repaso', async () => {
    const user = userEvent.setup()
    servidor()
    montarEditor('/cms/emails/nueva?uso=pesame')
    await screen.findByRole('textbox', { name: 'Texto de la carta' })
    await user.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('Rezamos por José García.')).toBeInTheDocument()
    expect(screen.getAllByText('Nuestro pésame por José García').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Todo en orden').length).toBeGreaterThan(0)
    expect(screen.getByTitle('El correo en el móvil')).toBeInTheDocument()
  })
})
