import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../theme/cms'
import ComunicadoEditPage from '../ComunicadoEditPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const BORRADOR = {
  id: 7, tipo: 'AVISO', asunto: 'Cabildo general', estado: 'BORRADOR', segmento: { conPapeleta: null, conDeuda: false, edad: null, poblacion: null },
  para: 'Hermanos activos', enviadoEl: null, autorNombre: 'Ana', createdAt: '2026-09-30T10:00:00Z', updatedAt: '2026-09-30T10:00:00Z',
  cuerpo: '<p>Se convoca cabildo.</p>',
}

afterEach(() => { vi.unstubAllGlobals() })

function montar(comunicado: unknown, envios = { enviados: 0, fallidos: 0, pendientes: 0 }) {
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const ruta = String(url)
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
  render(<HelmetProvider><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
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
