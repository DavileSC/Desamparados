import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import ListaImpagos from '../ListaImpagos'

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const MOROSO = {
  hermano: { id: 7, nombre: 'Luis', apellidos: 'Mora Sanz', numeroHermano: 120 },
  cuotas: [
    { id: 1, year: 2024, estado: 'DEVUELTO', importe: 30 },
    { id: 2, year: 2025, estado: 'PENDIENTE', importe: 30 },
  ],
  total: 60,
}
const pagina = (data: unknown[]) => ({ data, meta: { total: data.length, page: 1, limit: 20, totalPages: 1 }, anioActual: 2026 })

/** Contesta a la lista y a la baja; guarda lo que se pide para comprobarlo. */
function servidor(listas: unknown[][]) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = []
  let vez = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : null })
    if (metodo === 'DELETE') return respuesta({ message: 'ok' })
    return respuesta(pagina(listas[Math.min(vez++, listas.length - 1)]))
  }))
  return llamadas
}

describe('ListaImpagos', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('enseña quién debe, qué años y cuánto, y la cuota de este año solo si se pide', async () => {
    const user = userEvent.setup()
    const llamadas = servidor([[MOROSO]])
    renderWithProviders(<ListaImpagos puedeDarDeBaja={false} />)

    const fila = (await screen.findByText(/Mora Sanz, Luis/)).closest('li')!
    expect(within(fila).getByText('2024 (devuelta), 2025')).toBeInTheDocument()
    expect(within(fila).getByText('2 cuotas')).toBeInTheDocument()
    expect(within(fila).getByText(/60,00/)).toBeInTheDocument()
    // Tesorería mira: ni botón de baja ni enlace a la ficha del censo.
    expect(within(fila).queryByRole('button')).not.toBeInTheDocument()
    expect(within(fila).queryByRole('link')).not.toBeInTheDocument()
    expect(llamadas[0].url).not.toContain('incluirAnioActual')

    await user.click(screen.getByLabelText('Contar también la cuota de 2026'))
    await waitFor(() => expect(llamadas.at(-1)?.url).toContain('incluirAnioActual=true'))
  })

  it('Secretaría da la baja por impago desde la lista, y la lista se recarga', async () => {
    const user = userEvent.setup()
    const llamadas = servidor([[MOROSO], []])
    renderWithProviders(<ListaImpagos puedeDarDeBaja />)

    await user.click(await screen.findByRole('button', { name: /dar de baja por impago a luis mora sanz/i }))
    const dialogo = screen.getByRole('dialog', { name: /por impago a luis mora sanz/i })
    expect(within(dialogo).getByText(/debe 60,00/i)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Dar de baja por impago' }))

    expect(await screen.findByText(/ha causado baja por impago/i)).toBeInTheDocument()
    const [baja] = llamadas.filter((l) => l.metodo === 'DELETE')
    expect(baja.url).toContain('/hermanos/admin/7/baja')
    expect(baja.cuerpo).toMatchObject({ motivo: 'IMPAGO' })
    expect(await screen.findByText('Nadie debe cuotas con estos filtros.')).toBeInTheDocument()
  })
})
