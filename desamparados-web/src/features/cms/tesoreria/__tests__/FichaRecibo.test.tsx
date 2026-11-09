import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import FichaRecibo from '../FichaRecibo'
import type { AdminReceipt } from '../../../../lib/api/tesoreria'

const json = (cuerpo: unknown) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))

const recibo = (id: number, concepto: string, importe: string): AdminReceipt => ({
  id, year: 2026, concepto, importe, fechaEmision: '2026-09-24T10:00:00.000Z', estado: 'PENDIENTE', fechaPago: null, metodoPago: null,
  tipo: 'CUOTA_HERMANO', hermano: { id: 69, nombre: 'Beatriz', apellidos: 'Díaz Pérez', numeroHermano: 69 }, remesaId: null,
})

afterEach(() => { vi.unstubAllGlobals() })

describe('FichaRecibo', () => {
  it('cuenta su historial y, si el hermano debe más, ofrece cobrarlo todo a la vez', async () => {
    // Se rompe si la ficha deja de mirar lo demás que debe el hermano: es lo
    // que se hace cuando alguien viene a pagar.
    const cuota = recibo(4512, 'Cuota anual 2026', '36.00')
    const papeleta = recibo(4890, 'Papeleta de sitio 2026', '30.00')
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => String(url).includes('/historial')
      ? json({ observaciones: null, historial: [{ id: 1, accion: 'RECIBO_ACTUALIZAR', fecha: '2026-10-02T10:00:00.000Z', quien: 'Ana Tesorera', estado: 'EXENTO', metodoPago: null, nota: null }] })
      : json({ data: [cuota, papeleta], meta: { total: 2, page: 1, limit: 100, totalPages: 1 } })))
    const onCobrar = vi.fn()
    renderWithProviders(<FichaRecibo recibo={cuota} ocupado={false} onCerrar={vi.fn()} onCobrar={onCobrar} onConfirmar={vi.fn()} onReemitir={vi.fn()} onCambiarEstado={vi.fn()} />)

    expect(await screen.findByText('Pasa a exento')).toBeInTheDocument()
    expect(screen.getByText(/por Ana Tesorera/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(/^Emitido/)

    await userEvent.click(await screen.findByRole('button', { name: /cobrar sus 2 recibos · 66,00/i }))
    expect(onCobrar).toHaveBeenCalledWith([cuota, papeleta])
  })
})
