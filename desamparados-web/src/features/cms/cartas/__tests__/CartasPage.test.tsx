import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import CartasPage from '../CartasPage'

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
const CARTA = { id: 3, nombre: 'Cabildo de cuentas', asunto: 'Convocatoria', cuerpo: '{{saludo}} {{nombre}}:\n\nLe convocamos.', consulta: 'estado=activo', firmaCargo: 'El Secretario', firmaNombre: null, updatedAt: '2026-10-01T10:00:00.000Z' }

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    const u = String(url)
    if (u.includes('/cartas/pdf')) return Promise.resolve(new Response(new Blob(['%PDF-']), { status: 200, headers: { 'Content-Type': 'application/pdf' } }))
    if (u.includes('/cartas/destinatarios')) return Promise.resolve(json({ total: 245, demasiados: false, sinDireccion: 3 }))
    if (u.includes('/hermanos/admin/listas')) return Promise.resolve(json([{ id: 1, nombre: 'Sin correo', consulta: 'correo=sin' }]))
    if (metodo === 'POST' && u.endsWith('/cartas')) return Promise.resolve(json({ ...CARTA, id: 9, ...JSON.parse(String(init.body)) }))
    return Promise.resolve(json([CARTA]))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('CartasPage', () => {
  it('una carta nueva dice a cuántos va y se guarda con su búsqueda', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<CartasPage />)
    await user.click(await screen.findByRole('button', { name: 'Nueva carta' }))

    const editor = await screen.findByRole('region', { name: 'Carta nueva' })
    expect(await within(editor).findByText(/Saldrán 245 cartas, 3 sin dirección/)).toBeInTheDocument()
    await user.type(within(editor).getByRole('textbox', { name: 'Nombre de la carta' }), 'Rosario')
    await user.click(within(editor).getByRole('combobox', { name: 'A quién va' }))
    await user.click(await screen.findByRole('option', { name: 'Lista: Sin correo' }))
    await user.click(within(editor).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/cartas'))?.cuerpo).toMatchObject({ nombre: 'Rosario', consulta: 'correo=sin', firmaCargo: 'El Secretario' }))
  })

  it('los campos se ponen donde está el cursor, y uno mal escrito se avisa', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<CartasPage />)
    await user.click(await screen.findByRole('button', { name: /Cabildo de cuentas/ }))
    const texto = await screen.findByRole('textbox', { name: 'Texto' })
    await user.clear(texto)
    await user.type(texto, 'Hola ')
    await user.click(screen.getByRole('button', { name: '{{numero}}' }))
    expect(texto).toHaveValue('Hola {{numero}}')

    await user.type(texto, ' {{{{nobre}}')
    expect(await screen.findByText(/No se rellenará: \{\{nobre\}\}/)).toBeInTheDocument()
  })

  it('la vista previa pide solo la primera carta y la abre en otra pestaña', async () => {
    const user = userEvent.setup()
    const pestana = { location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window)
    const llamadas = servidor()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:cartas') }))
    renderWithProviders(<CartasPage />)
    await user.click(await screen.findByRole('button', { name: /Cabildo de cuentas/ }))
    await user.click(await screen.findByRole('button', { name: 'Vista previa' }))

    await waitFor(() => expect(pestana.location.href).toBe('blob:cartas'))
    expect(llamadas.find((l) => l.url.includes('/cartas/pdf'))?.cuerpo).toMatchObject({ prueba: true, consulta: 'estado=activo', asunto: 'Convocatoria' })
    expect(screen.getByRole('button', { name: 'Imprimir las 245 cartas' })).toBeInTheDocument()
  })
})
