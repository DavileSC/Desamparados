import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { TemaCmsProvider } from '../../../app/temaCms'
import AgendaEditPage from '../AgendaEditPage'

// Fechas en hora local, como las escribe quien usa la ficha.
const enLocal = (dia: string, hora: string) => new Date(`${dia}T${hora}`).toISOString()
const besapies = {
  id: 3, title: 'Besapiés', description: 'A la Virgen de los Desamparados.', location: 'Parroquia',
  startDate: enLocal('2099-10-12', '18:00'), endDate: null, type: 'CULTO',
  updatedAt: new Date().toISOString(),
}
const ensayo = { ...besapies, id: 4, title: 'Ensayo de costaleros', description: null, type: 'ENSAYO' }

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

/** El listado de verdad no hace falta: basta con ver que se vuelve a él y con qué aviso. */
function Listado() {
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso
  return <><h1>Listado de la agenda</h1>{aviso && <p>{aviso}</p>}</>
}

function montar(entrada: string | { pathname: string; state: unknown }) {
  // Lo que se guarda (POST o PUT) devuelve lo mismo que se manda.
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PUT') return Promise.resolve(json({ id: 1, ...JSON.parse(String(init.body)) }))
    const id = Number(String(url).match(/\/events\/(\d+)/)?.[1])
    const encontrado = [besapies, ensayo].find((e) => e.id === id)
    return Promise.resolve(encontrado ? json(encontrado) : json({ error: 'Evento no encontrado' }, 404))
  })
  vi.stubGlobal('fetch', simulado)
  const router = createMemoryRouter(
    [
      { path: '/cms/agenda', element: <Listado /> },
      { path: '/cms/agenda/nuevo', element: <AgendaEditPage /> },
      { path: '/cms/agenda/:id/editar', element: <AgendaEditPage /> },
    ],
    { initialEntries: [entrada] },
  )
  render(<HelmetProvider><TemaCmsProvider><RouterProvider router={router} /></TemaCmsProvider></HelmetProvider>)
  return simulado
}

function guardado(simulado: ReturnType<typeof montar>) {
  const llamada = simulado.mock.calls.findLast(([, init]) => init?.method === 'POST' || init?.method === 'PUT')
  if (!llamada) return null
  const [url, init] = llamada as [string, RequestInit]
  return { metodo: init.method, url: String(url), cuerpo: JSON.parse(String(init.body)) }
}

describe('AgendaEditPage', () => {
  it('carga el evento con el día y la hora por separado, y la vista previa de la portada', async () => {
    montar('/cms/agenda/3/editar')
    expect(await screen.findByDisplayValue('Besapiés')).toBeInTheDocument()
    expect(screen.getByLabelText('Día')).toHaveValue('2099-10-12')
    expect(screen.getByLabelText('Hora')).toHaveValue('18:00')
    const vista = screen.getByTestId('vista-previa-evento')
    expect(vista).toHaveTextContent('A la Virgen de los Desamparados.')
    expect(vista).toHaveTextContent('18:00 · Parroquia')
    expect(vista).toHaveTextContent('Culto')
  })

  it('todo acto tiene su vista previa de la portada, y no se pregunta quién lo ve', async () => {
    montar('/cms/agenda/4/editar')
    expect(await screen.findByDisplayValue('Ensayo de costaleros')).toBeInTheDocument()
    expect(screen.getByTestId('vista-previa-evento')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByText(/solo hermanos/i)).not.toBeInTheDocument()
  })

  it('explica el fallo si el evento no existe', async () => {
    montar('/cms/agenda/999/editar')
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })

  it('uno nuevo no se guarda sin título, día y hora, y dice qué falta', async () => {
    const usuario = userEvent.setup()
    montar('/cms/agenda/nuevo')
    const boton = await screen.findByRole('button', { name: 'Añadir a la agenda' })
    expect(boton).toBeDisabled()
    expect(screen.getByText('Para guardar hace falta el título, el día y la hora.')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Título'), 'Función principal')
    expect(screen.getByText('Para guardar hace falta el día y la hora.')).toBeInTheDocument()
  })

  it('crea el evento con el día y la hora juntos y vuelve al listado con un aviso', async () => {
    const usuario = userEvent.setup()
    const simulado = montar('/cms/agenda/nuevo')
    await usuario.type(await screen.findByLabelText('Título'), 'Función principal')
    await usuario.type(screen.getByLabelText('Día'), '2099-11-08')
    await usuario.type(screen.getByLabelText('Hora'), '12:00')
    await usuario.click(screen.getByRole('button', { name: 'Añadir a la agenda' }))

    expect(await screen.findByText('Añadido a la agenda: ya se ve en la web.')).toBeInTheDocument()
    const peticion = guardado(simulado)!
    expect(peticion.metodo).toBe('POST')
    expect(peticion.cuerpo).toMatchObject({ title: 'Función principal', startDate: enLocal('2099-11-08', '12:00'), endDate: null, type: 'CULTO' })
    expect(peticion.cuerpo).not.toHaveProperty('visibility')
  })

  it('no deja guardar si el final es anterior al comienzo', async () => {
    const usuario = userEvent.setup()
    montar('/cms/agenda/3/editar')
    await usuario.click(await screen.findByLabelText('Tiene hora de final'))
    await usuario.type(screen.getByLabelText('A las'), '17:00')

    expect(screen.getByText('El final es anterior al comienzo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('al editar manda el cambio', async () => {
    const usuario = userEvent.setup()
    const simulado = montar('/cms/agenda/3/editar')
    await usuario.clear(await screen.findByLabelText('Lugar'))
    await usuario.type(screen.getByLabelText('Lugar'), 'Parroquia de San Juan')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Cambios guardados: ya se ven en la web.')).toBeInTheDocument()
    const peticion = guardado(simulado)!
    expect(peticion).toMatchObject({ metodo: 'PUT', cuerpo: { location: 'Parroquia de San Juan', startDate: besapies.startDate } })
    expect(peticion.url).toContain('/events/3')
  })

  it('duplicar parte del evento pero crea uno nuevo', async () => {
    const usuario = userEvent.setup()
    const simulado = montar({ pathname: '/cms/agenda/nuevo', state: { copiaDe: 3 } })
    expect(await screen.findByDisplayValue('Besapiés')).toBeInTheDocument()
    expect(screen.getByText('Copia de «Besapiés»: cambia el día y guárdalo.')).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText('Día'))
    await usuario.type(screen.getByLabelText('Día'), '2099-10-19')
    await usuario.click(screen.getByRole('button', { name: 'Añadir a la agenda' }))

    await waitFor(() => expect(guardado(simulado)?.metodo).toBe('POST'))
    expect(guardado(simulado)!.cuerpo).toMatchObject({ title: 'Besapiés', location: 'Parroquia', startDate: enLocal('2099-10-19', '18:00') })
  })

  it('avisa si el día ya ha pasado', async () => {
    const usuario = userEvent.setup()
    montar('/cms/agenda/nuevo')
    await usuario.type(await screen.findByLabelText('Día'), '2001-01-01')
    expect(screen.getByText('Ese día ya ha pasado: el acto no saldrá en la web.')).toBeInTheDocument()
  })
})
