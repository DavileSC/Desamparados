import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ProcesionAdminPage from '../ProcesionAdminPage'
import { useAuthStore } from '../../altas/auth/store'
import type { PlazoDePapeletas } from '../../../lib/api/procesion'
import { salidasDePrueba, salidaPasion, salidaRosario, esListaDeSalidas } from '../../../test/salidas'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const PLAZO: PlazoDePapeletas = {
  salida: 'sabado-de-pasion', abierto: false, cambiadoEl: null, year: 2027, diasDeReparto: 1,
  primerDia: '2027-03-08T00:00:00.000Z', ultimoDia: '2027-03-08T00:00:00.000Z',
  citasReservadas: 0, cuotaSalida: 0,
}
const plazoDelRosario: PlazoDePapeletas = { ...PLAZO, salida: 'rosario-vespertino', year: 2026, cuotaSalida: null, fecha: null }
const TURNO = { id: 5, salidaId: 1, fecha: '2027-03-08T00:00:00.000Z', horaInicio: '2027-03-08T17:00:00.000Z', horaFin: '2027-03-08T20:00:00.000Z', capacidadEstimada: 100, activo: true, citas: 0, vinieron: 0 }

function servidor(plazo = PLAZO, turnos = [TURNO], { salidas = salidasDePrueba, rosario = plazoDelRosario, abrir = () => json({ abierto: true, avisados: 120, noticiaId: 33 }) } = {}) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (esListaDeSalidas(String(url))) return Promise.resolve(json(salidas))
    if (String(url).includes('/admin/plazo') && metodo === 'POST') return Promise.resolve(abrir())
    if (String(url).includes('/admin/plazo?salida=rosario-vespertino')) return Promise.resolve(json(rosario))
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
    expect(screen.getByRole('dialog', { name: '¿Abrir la solicitud de papeletas del Sábado de Pasión?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir la solicitud' }))

    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true))
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ abierto: true, avisar: true, borradorNoticia: true, salida: 'sabado-de-pasion' })
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

  it('un día ya pasado no se puede borrar; uno por venir y sin citas, sí', async () => {
    const PASADO = { ...TURNO, id: 4, fecha: '2026-03-02T00:00:00.000Z', horaInicio: '2026-03-02T18:00:00.000Z', horaFin: '2026-03-02T21:00:00.000Z' }
    servidor(PLAZO, [PASADO, TURNO])
    renderWithProviders(<ProcesionAdminPage />)

    expect(await screen.findByRole('button', { name: /borrar el día lunes, 8 de marzo de 2027/i })).toBeEnabled()
    expect(screen.getByText(/2 de marzo de 2026 · pasado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /borrar el día lunes, 2 de marzo de 2026/i })).not.toBeInTheDocument()
  })

  it('los días pasados cuentan a quien vino; el aforo solo sale en los que quedan', async () => {
    const PASADO = { ...TURNO, id: 4, fecha: '2026-03-02T00:00:00.000Z', horaInicio: '2026-03-02T18:00:00.000Z', horaFin: '2026-03-02T21:00:00.000Z', capacidadEstimada: 80, citas: 47, vinieron: 41 }
    servidor(PLAZO, [PASADO, { ...TURNO, citas: 12 }])
    renderWithProviders(<ProcesionAdminPage />)

    const pasado = (await screen.findByText(/2 de marzo de 2026 · pasado/i)).closest('tr')!
    expect(pasado).toHaveTextContent('47')
    expect(pasado).toHaveTextContent('41')
    expect(pasado).not.toHaveTextContent('de 80')
    const futuro = screen.getByText(/8 de marzo de 2027/i).closest('tr')!
    expect(futuro).toHaveTextContent('12 de 100')
    expect(futuro).toHaveTextContent('—')
  })

  it('el Hermano Mayor lo ve, pero no abre ni crea días', async () => {
    como('HERMANO_MAYOR')
    servidor()
    renderWithProviders(<ProcesionAdminPage />)

    expect(await screen.findByRole('switch', { name: /solicitud de papeletas abierta/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /nuevo día de reparto/i })).not.toBeInTheDocument()
  })

  it('sin cuota de salida lo dice, y la cuota se cambia en Procesión → Salidas', async () => {
    servidor()
    renderWithProviders(<ProcesionAdminPage />)
    expect(await screen.findByText('No se cobra')).toBeInTheDocument()
    expect(screen.queryByText(/alquiler/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Procesión → Salidas' })).toHaveAttribute('href', '/cms/procesion/salidas')
    expect(screen.queryByRole('button', { name: 'Cambiar' })).not.toBeInTheDocument()
  })

  it('una pestaña por salida activa, con su nombre', async () => {
    const TRASLADO = { ...salidaRosario, id: 3, slug: 'traslado', nombre: 'Traslado', orden: 2 }
    servidor(PLAZO, [TURNO], { salidas: [salidaPasion, salidaRosario, TRASLADO] })
    renderWithProviders(<ProcesionAdminPage />)
    expect(await screen.findByRole('tab', { name: 'Traslado' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Sábado de Pasión', 'Rosario vespertino', 'Traslado'])
  })

  it('sin salidas activas lo dice y lleva a crearlas', async () => {
    servidor(PLAZO, [], { salidas: [] })
    renderWithProviders(<ProcesionAdminPage />)
    expect(await screen.findByText(/no hay salidas activas/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Procesión → Salidas' })).toHaveAttribute('href', '/cms/procesion/salidas')
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('una salida a mano con fecha la enseña, y la de abrir sin fecha se dice tal cual', async () => {
    const user = userEvent.setup()
    servidor(PLAZO, [TURNO], {
      rosario: { ...plazoDelRosario, fecha: { eventoId: 9, inicio: '2026-10-17T17:30:00.000Z', lugar: null } },
      abrir: () => json({ error: 'Pon antes la fecha de la salida en la Agenda.' }, 409),
    })
    renderWithProviders(<ProcesionAdminPage />)

    await user.click(await screen.findByRole('tab', { name: 'Rosario vespertino' }))
    expect(await screen.findByText(/sale el sábado, 17 de octubre de 2026 a las 19:30/i)).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: /solicitud de papeletas abierta/i }))
    await user.click(screen.getByRole('button', { name: 'Abrir la solicitud' }))
    expect(await screen.findByText('Pon antes la fecha de la salida en la Agenda.')).toBeInTheDocument()
  })

  it('una salida a mano tiene su plazo, y su fecha se cambia en Salidas', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<ProcesionAdminPage />)

    await user.click(await screen.findByRole('tab', { name: 'Rosario vespertino' }))
    expect(await screen.findByText(/todavía sin fecha/i)).toBeInTheDocument()
    expect(screen.getByText('La voluntad')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cambiar la fecha en Salidas' })).toHaveAttribute('href', '/cms/procesion/salidas')
    expect(llamadas.some((l) => l.url.includes('/admin/turnos?salida=rosario-vespertino'))).toBe(true)
  })

  it('la Pasión, que va por la Pascua, no enseña fecha que cambiar', async () => {
    servidor()
    renderWithProviders(<ProcesionAdminPage />)
    expect(await screen.findByRole('switch', { name: /solicitud de papeletas abierta/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cambiar la fecha en Salidas' })).not.toBeInTheDocument()
  })
})
