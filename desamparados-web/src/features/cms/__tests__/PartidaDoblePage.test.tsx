import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import PartidaDoblePage from '../PartidaDoblePage'

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
const EJERCICIO = {
  anio: 2026, asientos: 3, categoriasPropuestas: 1,
  sumas: [
    { cuenta: '570', nombre: 'Caja, euros', debe: 30, haber: 0, saldo: 30 },
    { cuenta: '720', nombre: 'Cuotas de asociados y afiliados', debe: 0, haber: 60, saldo: -60 },
  ],
  resultados: {
    ingresos: [{ cuenta: '720', nombre: 'Cuotas de asociados y afiliados', importe: 60 }],
    gastos: [{ cuenta: '602', nombre: 'Compras de otros aprovisionamientos', importe: 12.5 }],
    totalIngresos: 60, totalGastos: 12.5, excedente: 47.5,
  },
}
const PLAN = {
  cuentas: [{ codigo: '602', nombre: 'Compras de otros aprovisionamientos' }, { codigo: '629', nombre: 'Otros servicios' }, { codigo: '720', nombre: 'Cuotas de asociados y afiliados' }],
  categorias: [{ id: 5, nombre: 'Culto y cera', tipo: 'GASTO', activa: true, cuenta: '602', nombreCuenta: 'Compras de otros aprovisionamientos', propuesta: true }],
}

afterEach(() => { vi.unstubAllGlobals() })

describe('PartidaDoblePage', () => {
  it('enseña la cuenta de resultados y avisa de las cuentas propuestas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(json(String(url).includes('/plan') ? PLAN : EJERCICIO))))
    renderWithProviders(<PartidaDoblePage />)
    expect(await screen.findByText('Excedente del ejercicio')).toBeInTheDocument()
    expect(screen.getByText('47,50 €')).toBeInTheDocument()
    expect(screen.getByText(/Una categoría usa la cuenta que se propone por su nombre/)).toBeInTheDocument()
  })

  it('en el plan de cuentas, cambiar la de una categoría la guarda', async () => {
    const user = userEvent.setup()
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => Promise.resolve(json(
      init.method === 'PUT' ? { ...PLAN, categorias: [{ ...PLAN.categorias[0], cuenta: '629', propuesta: false }] } : String(url).includes('/plan') ? PLAN : EJERCICIO,
    )))
    vi.stubGlobal('fetch', fetch)
    renderWithProviders(<PartidaDoblePage />)
    await user.click(await screen.findByRole('tab', { name: 'Plan de cuentas' }))
    await user.click(screen.getByRole('combobox', { name: 'Cuenta de Culto y cera' }))
    await user.click(await screen.findByRole('option', { name: /629 · Otros servicios/ }))
    await waitFor(() => {
      const put = fetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')!
      expect(String(put[0])).toContain('/partida-doble/categorias/5')
      expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ cuenta: '629' })
    })
  })
})
