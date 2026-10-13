import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import { crearQueryClientDePruebas } from '../../../test/queryClient'
import ComunicadoEditPage from '../ComunicadoEditPage'
import { salidasDePrueba, esListaDeSalidas } from '../../../test/salidas'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const BORRADOR = {
  id: 7, tipo: 'AVISO', asunto: 'Cabildo general', estado: 'BORRADOR', segmento: { conPapeleta: null, conDeuda: false, edad: null, poblacion: null },
  para: 'Hermanos activos', enviadoEl: null, autorNombre: 'Ana', createdAt: '2026-09-30T10:00:00Z', updatedAt: '2026-09-30T10:00:00Z',
  cuerpo: '<p>Se convoca cabildo.</p>',
}

afterEach(() => { vi.unstubAllGlobals() })

// `ComunicadoEditPage` pregunta a `useModulos()` (un `useQuery`): sin
// `crearQueryClientDePruebas`, la consulta de módulos caería en el `fetch`
// simulado de aquí abajo (pensado para las rutas del comunicado) y rompería
// con una respuesta que no es la lista de módulos.
function montar(comunicado: unknown, envios = { enviados: 0, fallidos: 0, pendientes: 0 }, modulos?: readonly string[]) {
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const ruta = String(url)
    if (esListaDeSalidas(ruta)) return Promise.resolve(json(salidasDePrueba))
    if (ruta.endsWith('/destinatarios')) return Promise.resolve(json({ para: 'Hermanos activos', fichas: 12, correos: 10, sinCorreo: 2 }))
    if (ruta.endsWith('/prueba')) return Promise.resolve(json({ message: 'Prueba enviada a ana@ejemplo.es.' }))
    if (ruta.endsWith('/enviar')) return Promise.resolve(json({ message: 'Enviando a 10 direcciones.', destinatarios: 10 }))
    if (ruta.endsWith('/comunicados')) return Promise.resolve(json([{ ...(comunicado as object), envios }]))
    if (init.method === 'PUT') return Promise.resolve(json({ ...(comunicado as object), ...JSON.parse(String(init.body)) }))
    return Promise.resolve(json(comunicado))
  })
  vi.stubGlobal('fetch', fetch)
  const router = createMemoryRouter(
    [{ path: '/cms/comunicados', element: <h1>Listado</h1> }, { path: '/cms/comunicados/:id', element: <ComunicadoEditPage /> }],
    { initialEntries: ['/cms/comunicados/7'] },
  )
  const cliente = crearQueryClientDePruebas(modulos)
  render(<HelmetProvider><QueryClientProvider client={cliente}><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></QueryClientProvider></HelmetProvider>)
  return fetch
}

describe('ComunicadoEditPage', () => {
  it('el borrador dice a cuántos llegará y el segmento cambia el recuento', async () => {
    const user = userEvent.setup()
    const fetch = montar(BORRADOR)
    expect(await screen.findByDisplayValue('Cabildo general')).toBeInTheDocument()
    expect(await screen.findByText(/Llegará a 10 direcciones \(2 fichas no tienen correo\)/)).toBeInTheDocument()

    await user.click(screen.getByLabelText('Solo quien tiene cuotas pendientes'))
    await waitFor(() => {
      const ultima = fetch.mock.calls.filter(([url]) => String(url).endsWith('/destinatarios')).at(-1)!
      expect(JSON.parse(String((ultima[1] as RequestInit).body)).segmento.conDeuda).toBe(true)
    })
  })

  it('«con papeleta» ofrece las salidas activas y filtra por su id', async () => {
    const user = userEvent.setup()
    const fetch = montar(BORRADOR)
    await screen.findByText(/Llegará a 10 direcciones/)

    await user.click(screen.getByRole('combobox', { name: 'Papeleta' }))
    const opciones = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toEqual([
      'Da igual',
      'Con papeleta del Sábado de Pasión', 'Apuntados al Sábado de Pasión',
      'Con papeleta del Rosario vespertino', 'Apuntados al Rosario vespertino',
    ])
    await user.click(screen.getByRole('option', { name: 'Con papeleta del Rosario vespertino' }))
    await waitFor(() => {
      const ultima = fetch.mock.calls.filter(([url]) => String(url).endsWith('/destinatarios')).at(-1)!
      expect(JSON.parse(String((ultima[1] as RequestInit).body)).segmento.conPapeleta).toBe(2)
    })
  })

  it('«apuntados a» una salida filtra por su id, quita el «con papeleta» y dice qué es', async () => {
    const user = userEvent.setup()
    const fetch = montar({ ...BORRADOR, segmento: { ...BORRADOR.segmento, conPapeleta: 1 } })
    await screen.findByText(/Llegará a 10 direcciones/)

    await user.click(screen.getByRole('combobox', { name: 'Papeleta' }))
    await user.click(await screen.findByRole('option', { name: 'Apuntados al Sábado de Pasión' }))
    expect(screen.getByText('Con su papeleta de este año, o pedida y aún sin recoger.')).toBeInTheDocument()
    await waitFor(() => {
      const ultima = fetch.mock.calls.filter(([url]) => String(url).endsWith('/destinatarios')).at(-1)!
      expect(JSON.parse(String((ultima[1] as RequestInit).body)).segmento).toMatchObject({ apuntadosA: 1, conPapeleta: null })
    })
  })

  it('con Procesión apagado no está el filtro «con papeleta de» ni se piden las salidas', async () => {
    const fetch = montar(BORRADOR, undefined, ['comunicados'])
    await screen.findByText(/Llegará a 10 direcciones/)
    expect(screen.queryByRole('combobox', { name: 'Papeleta' })).not.toBeInTheDocument()
    expect(fetch.mock.calls.filter(([url]) => esListaDeSalidas(String(url)))).toEqual([])
  })

  it('con Procesión apagado, guardar conserva el «con papeleta de» que ya tuviera el comunicado', async () => {
    // Un comunicado guardado antes de apagar Procesión: apagar es ocultar. El
    // filtro no se enseña, pero el dato viaja tal cual; el servidor lo ignora
    // mientras el módulo esté apagado y vuelve a valer al encenderlo.
    const user = userEvent.setup()
    const guardado = { ...BORRADOR, segmento: { ...BORRADOR.segmento, conPapeleta: 2 } }
    const fetch = montar(guardado, undefined, ['comunicados'])
    await screen.findByText(/Llegará a 10 direcciones/)

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      const put = fetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      expect(put).toBeDefined()
      expect(JSON.parse(String((put![1] as RequestInit).body)).segmento.conPapeleta).toBe(2)
    })
    expect(screen.queryByRole('combobox', { name: 'Papeleta' })).not.toBeInTheDocument()
  })

  it('con todos los módulos, guardar conserva el «con papeleta de» que trajera el comunicado', async () => {
    const user = userEvent.setup()
    const guardado = { ...BORRADOR, segmento: { ...BORRADOR.segmento, conPapeleta: 2 } }
    const fetch = montar(guardado)
    await screen.findByText(/Llegará a 10 direcciones/)

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      const put = fetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      expect(put).toBeDefined()
      expect(JSON.parse(String((put![1] as RequestInit).body)).segmento.conPapeleta).toBe(2)
    })
  })

  it('la prueba y el envío, este tras confirmar', async () => {
    const user = userEvent.setup()
    const fetch = montar(BORRADOR)
    await screen.findByText(/Llegará a 10 direcciones/)

    await user.click(screen.getByRole('button', { name: 'Enviarme una prueba' }))
    expect(await screen.findByText('Prueba enviada a ana@ejemplo.es.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/Se mandará a 10 direcciones/)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith('/comunicados/7/enviar') && (init as RequestInit).method === 'POST')).toBe(true))
  })

  it('lo enviado se enseña tal cual, con cómo fue el envío y los fallidos por reintentar', async () => {
    montar({ ...BORRADOR, estado: 'ENVIADO', enviadoEl: '2026-09-30T11:00:00Z' }, { enviados: 8, fallidos: 2, pendientes: 0 })
    expect(await screen.findByText('Enviado a 8 direcciones')).toBeInTheDocument()
    expect(screen.getByText('Se convoca cabildo.')).toBeInTheDocument()
    expect(screen.getByText(/2 correos no han salido/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar' })).not.toBeInTheDocument()
  })
})
