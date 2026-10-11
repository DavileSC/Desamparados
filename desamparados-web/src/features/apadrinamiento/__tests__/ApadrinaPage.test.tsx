import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
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

function servidor(alApadrinar: unknown = { tipo: 'hecho', token: 'a'.repeat(32) }) {
  const llamadas: { metodo: string; cuerpo?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    return Promise.resolve(metodo === 'POST' ? json(alApadrinar, 201) : json(CAMPANAS))
  }))
  return llamadas
}

/** Dónde está la página: para ver adónde lleva tras apadrinar. */
const Ruta = () => <div data-testid="ruta">{useLocation().pathname}</div>

/** Elige la vela, rellena lo obligatorio y pulsa «Pagar». */
async function apadrinarLaVela(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Vela 1: libre/ }))
  const ventana = await screen.findByRole('dialog')
  await user.type(within(ventana).getByLabelText('Nombre y apellidos'), 'Ana Ruiz')
  await user.type(within(ventana).getByLabelText('Correo'), 'ana@ejemplo.es')
  await user.type(within(ventana).getByLabelText('Teléfono'), '600111222')
  await user.click(within(ventana).getByRole('button', { name: /Pagar/ }))
  return ventana
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

  it('enseña el precio de la pieza y no lo manda: el importe lo pone el servidor', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<ApadrinaPage />, { ruta: '/apadrina' })
    await user.click(await screen.findByRole('button', { name: /Vela 1: libre/ }))
    const ventana = await screen.findByRole('dialog')
    expect(within(ventana).getByRole('heading', { name: /Apadrinar Vela 1 · 25,00\u00a0€/ })).toBeInTheDocument()
    await user.click(within(ventana).getByRole('button', { name: 'Volver' }))
    await apadrinarLaVela(user)
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true))
    const cuerpo = llamadas.find((l) => l.metodo === 'POST')!.cuerpo!
    expect(cuerpo).not.toHaveProperty('precio')
    expect(cuerpo).not.toHaveProperty('importe')
  })

  it('sin pago que hacer, lleva a la página de gracias con su token', async () => {
    const user = userEvent.setup()
    servidor({ tipo: 'hecho', token: 'b'.repeat(32) })
    renderWithProviders(<><ApadrinaPage /><Ruta /></>, { ruta: '/apadrina' })
    await apadrinarLaVela(user)
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent(`/apadrina/gracias/${'b'.repeat(32)}`))
  })

  it('con pago, manda al banco por POST con los campos firmados', async () => {
    const user = userEvent.setup()
    const enviados: HTMLFormElement[] = []
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) { enviados.push(this) })
    servidor({ tipo: 'banco', token: 'c'.repeat(32), pedido: '0001AP', url: 'https://sis-t.redsys.es:25443/sis/realizarPago', campos: { Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: 'e30=', Ds_Signature: 'firma' } })
    renderWithProviders(<><ApadrinaPage /><Ruta /></>, { ruta: '/apadrina' })
    await apadrinarLaVela(user)
    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0].method).toBe('post')
    expect(enviados[0].action).toBe('https://sis-t.redsys.es:25443/sis/realizarPago')
    expect(Object.fromEntries(new FormData(enviados[0]))).toEqual({ Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: 'e30=', Ds_Signature: 'firma' })
    // No se adelanta a la página de gracias: a ella vuelve el banco.
    expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/apadrina$/)
  })
})
