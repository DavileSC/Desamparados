import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ProcesionAdminPage from '../ProcesionAdminPage'
import { useAuthStore } from '../../altas/auth/store'
import type { PlazoDePapeletas } from '../../../lib/api/procesion'

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

const PLAZO: PlazoDePapeletas = {
  abierto: false, cambiadoEl: null, year: 2027, diasDeReparto: 1,
  primerDia: '2027-03-08T00:00:00.000Z', ultimoDia: '2027-03-08T00:00:00.000Z',
  citasReservadas: 0, precios: { papeleta: 30, alquilerTunica: 15 },
}
const TURNO = { id: 5, fecha: '2027-03-08T00:00:00.000Z', horaInicio: '2027-03-08T17:00:00.000Z', horaFin: '2027-03-08T20:00:00.000Z', capacidadEstimada: 100, activo: true, _count: { citas: 0 } }

function servidor(plazo = PLAZO, turnos = [TURNO]) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (String(url).includes('/admin/plazo') && metodo === 'POST') return Promise.resolve(json({ abierto: true, avisados: 120, noticiaId: 33 }))
    if (String(url).includes('/admin/plazo')) return Promise.resolve(json(plazo))
    return Promise.resolve(json(turnos))
  }))
  return llamadas
}

const como = (role: string) =>
  useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'secre@ejemplo.es', role, perfiles: [], origen: 'cms' }, hermano: null })

beforeEach(() => como('SECRETARIA'))
afterEach(() => { vi.unstubAllGlobals() })

describe('ProcesionAdminPage', () => {
  it('abrir pregunta antes y avisa por correo y deja el borrador de noticia', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<ProcesionAdminPage />)

    await user.click(await screen.findByRole('switch', { name: /solicitud de papeletas abierta/i }))
    expect(screen.getByRole('dialog', { name: /abrir la solicitud/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir la solicitud' }))

    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true))
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ abierto: true, avisar: true, borradorNoticia: true })
    expect(await screen.findByText(/avisando por correo a 120 cuentas/i)).toBeInTheDocument()
    // El diálogo tarda en cerrarse: hasta entonces el resto de la página queda oculto.
    expect(await screen.findByRole('link', { name: 'borrador de noticia' })).toHaveAttribute('href', '/cms/noticias/33/editar')
  })

  it('sin días de reparto no deja abrir', async () => {
    servidor({ ...PLAZO, diasDeReparto: 0, primerDia: null, ultimoDia: null }, [])
    renderWithProviders(<ProcesionAdminPage />)

    expect(await screen.findByRole('switch', { name: /solicitud de papeletas abierta/i })).toBeDisabled()
    expect(screen.getByText(/no se puede abrir/i)).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay días de reparto.')).toBeInTheDocument()
  })

  it('el Hermano Mayor lo ve, pero no abre ni crea días', async () => {
    como('HERMANO_MAYOR')
    servidor()
    renderWithProviders(<ProcesionAdminPage />)

    expect(await screen.findByRole('switch', { name: /solicitud de papeletas abierta/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /nuevo día de reparto/i })).not.toBeInTheDocument()
  })
})
