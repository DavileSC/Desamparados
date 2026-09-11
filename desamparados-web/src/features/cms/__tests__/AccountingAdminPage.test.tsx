import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import AccountingAdminPage from '../AccountingAdminPage'

afterEach(() => { vi.unstubAllGlobals() })

const RESUMEN = {
  totales: { ingresos: 12874, gastos: 6998, resultado: 5876, apuntesIngreso: 326, apuntesGasto: 54 },
  anterior: { desde: '2025-01-01', hasta: '2025-09-11', ingresos: 11495, gastos: 7422.5 },
  serie: { granularidad: 'mes', puntos: [{ clave: '2026-01', ingresos: 484, gastos: 883 }, { clave: '2026-02', ingresos: 1426, gastos: 772 }, { clave: '2026-03', ingresos: 4076, gastos: 931 }] },
  categorias: [
    { id: 1, nombre: 'Cuotas y papeletas', tipo: 'INGRESO', total: 10628, apuntes: 315 },
    { id: 6, nombre: 'Flores y exorno', tipo: 'GASTO', total: 2156, apuntes: 8 },
  ],
}

const APUNTES = [
  { id: 1, tipo: 'INGRESO', concepto: 'Cuota anual', importe: '18', fecha: '2026-09-11T00:00:00.000Z', metodoPago: 'EFECTIVO', categoria: { nombre: 'Cuotas y papeletas' }, hermano: { nombre: 'Juan', apellidos: 'El Cofrade' } },
  { id: 2, tipo: 'GASTO', concepto: 'Exorno floral', importe: '342', fecha: '2026-08-09T00:00:00.000Z', metodoPago: 'TRANSFERENCIA', categoria: { nombre: 'Flores y exorno' }, hermano: null },
]

// mockImplementation, no mockResolvedValue: la pantalla lanza varios fetch a la
// vez, cada uno con su forma, y una misma Response no se puede leer dos veces.
// Se responde por URL, nunca por el orden de las llamadas.
function servir(totalApuntes = APUNTES.length) {
  const simulado = vi.fn().mockImplementation((url: string) => {
    const ruta = String(url)
    const cuerpo = ruta.includes('libro-mayor')
      ? { data: APUNTES, meta: { total: totalApuntes, page: 1, limit: 20, totalPages: Math.max(1, Math.ceil(totalApuntes / 20)) } }
      : ruta.includes('resumen') ? RESUMEN
      : ruta.includes('categorias') ? [{ id: 1, nombre: 'Cuotas y papeletas', tipo: 'INGRESO' }, { id: 6, nombre: 'Flores y exorno', tipo: 'GASTO' }]
      : {}
    return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  })
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const ultima = (simulado: ReturnType<typeof servir>, trozo: string) =>
  String(simulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes(trozo)).at(-1))

const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('AccountingAdminPage', () => {
  it('dice cuántos movimientos hay en total', async () => {
    servir(1278)
    renderWithProviders(<AccountingAdminPage />)
    expect(await screen.findByText(/de 1278/i)).toBeInTheDocument()
  })

  it('las cifras salen del resumen y el resultado se lee como superávit, sin signos', async () => {
    servir()
    renderWithProviders(<AccountingAdminPage />)

    const cifras = await screen.findByRole('region', { name: /cifras del periodo/i })
    expect(within(cifras).getByText('12.874 €')).toBeInTheDocument()
    expect(within(cifras).getByText('6.998 €')).toBeInTheDocument()
    expect(within(cifras).getByText('5.876 €')).toBeInTheDocument()
    expect(within(cifras).getByText(/superávit/i)).toBeInTheDocument()
    expect(within(cifras).getByText(/11\.495 €/)).toBeInTheDocument()
  })

  it('cada importe va en su columna, ingreso o gasto, sin «+» ni «−»', async () => {
    servir()
    renderWithProviders(<AccountingAdminPage />)

    const fila = await screen.findByRole('row', { name: /exorno floral/i })
    const celdas = within(fila).getAllByRole('cell')
    expect(celdas.at(-1)).toHaveTextContent('342,00 €')
    expect(celdas.at(-2)).toHaveTextContent('')
    expect(fila).not.toHaveTextContent(/[+−-]\s?342/)
    const libro = screen.getByRole('table', { name: /libro de caja/i })
    expect(within(libro).getByRole('columnheader', { name: /^ingreso$/i })).toBeInTheDocument()
    expect(within(libro).getByRole('columnheader', { name: /^gasto$/i })).toBeInTheDocument()
  })

  it('por defecto pide el año en curso hasta hoy, al libro y al resumen', async () => {
    const simulado = servir()
    renderWithProviders(<AccountingAdminPage />)

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain(`desde=${new Date().getFullYear()}-01-01`))
    expect(ultima(simulado, 'libro-mayor')).toContain(`hasta=${hoy()}`)
    expect(ultima(simulado, 'resumen')).toContain(`desde=${new Date().getFullYear()}-01-01`)
  })

  it('los filtros de la URL llegan al libro y al resumen', async () => {
    const simulado = servir()
    renderWithProviders(<AccountingAdminPage />, { ruta: '/cms/contabilidad?tipo=GASTO&periodo=todo&q=flores' })

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('tipo=GASTO'))
    for (const trozo of ['libro-mayor', 'resumen']) {
      expect(ultima(simulado, trozo)).toContain('tipo=GASTO')
      expect(ultima(simulado, trozo)).toContain('q=flores')
      expect(ultima(simulado, trozo)).not.toContain('desde=')
    }
  })

  it('elegir «Gastos» filtra y vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const simulado = servir(120)
    renderWithProviders(<AccountingAdminPage />, { ruta: '/cms/contabilidad?pagina=3' })

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('page=3'))
    await user.click(screen.getByRole('button', { name: /^gastos$/i }))

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('tipo=GASTO'))
    expect(ultima(simulado, 'libro-mayor')).toContain('page=1')
  })

  it('pinchar una categoría del reparto filtra por ella, y la etiqueta la quita', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<AccountingAdminPage />)

    const reparto = await screen.findByRole('region', { name: /de dónde viene y a dónde va/i })
    await user.click(await within(reparto).findByRole('button', { name: /flores y exorno/i }))
    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('categorias=6'))

    await user.click(screen.getByRole('button', { name: /quitar el filtro categoría/i }))
    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).not.toContain('categorias='))
  })

  it('busca por concepto o hermano', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<AccountingAdminPage />)

    await user.type(await screen.findByRole('textbox', { name: /buscar/i }), 'juan')
    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('q=juan'))
  })

  it('apunte y categoría van cada uno en su ventana', async () => {
    const user = userEvent.setup()
    servir()
    renderWithProviders(<AccountingAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nuevo apunte/i }))
    expect(screen.getByRole('dialog', { name: /nuevo apunte/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/concepto/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    // Con la ventana abierta, MUI esconde el resto de la pantalla a la accesibilidad.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
    expect(await screen.findByRole('dialog', { name: /nueva categoría/i })).toBeInTheDocument()
  })
})
