import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ApadrinaPage from '../ApadrinaPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const CAMPANAS = {
  pagoDisponible: true, metodos: ['TARJETA'],
  campanas: [{
    id: 1, titulo: 'Velas del paso', descripcion: '', foto: '/storage/public/velas.webp', activa: true, libres: 1,
    piezas: [{ id: 7, nombre: 'Vela 1', precio: 25, x: 50, y: 50, apadrinada: false, padrino: null, dedicatoria: null }],
  }],
}

function servidor() {
  const llamadas: { metodo: string; cuerpo?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    return Promise.resolve(metodo === 'POST' ? json({ tipo: 'hecho', token: 'a'.repeat(32) }, 201) : json(CAMPANAS))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('ApadrinaPage', () => {
  it('«Pagar» dice qué falta en vez de quedarse en gris, y manda el teléfono con nueve cifras', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<ApadrinaPage />, { ruta: '/apadrina' })

    await user.click(await screen.findByRole('button', { name: /Vela 1: libre/ }))
    const ventana = await screen.findByRole('dialog')
    const pagar = within(ventana).getByRole('button', { name: /Pagar 25,00/ })
    await user.click(pagar)
    expect(within(ventana).getByText('Escribe tu nombre.')).toBeInTheDocument()
    expect(within(ventana).getByText('Escribe tu teléfono.')).toBeInTheDocument()
    expect(within(ventana).getByLabelText('Nombre y apellidos')).toHaveFocus()
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false)

    await user.type(within(ventana).getByLabelText('Nombre y apellidos'), 'Ana Ruiz')
    await user.type(within(ventana).getByLabelText('Correo'), 'ana@ejemplo.es')
    await user.type(within(ventana).getByLabelText('Teléfono'), '600 11 12')
    await user.click(pagar)
    expect(within(ventana).getByText('Un teléfono de nueve cifras.')).toBeInTheDocument()
    expect(within(ventana).getByLabelText('Teléfono')).toHaveFocus()

    await user.clear(within(ventana).getByLabelText('Teléfono'))
    await user.type(within(ventana).getByLabelText('Teléfono'), '+34 600 11 12 22')
    await user.click(pagar)
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({ piezaId: 7, nombre: 'Ana Ruiz', email: 'ana@ejemplo.es', telefono: '600111222' }))
  })
})
