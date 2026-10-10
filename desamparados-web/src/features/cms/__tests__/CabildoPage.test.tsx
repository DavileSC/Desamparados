import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../theme/cms'
import CabildoPage from '../CabildoPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const CABILDO = {
  id: 3, tipo: 'ORDINARIO', fecha: '2026-10-15T18:30:00.000Z', lugar: 'Salón parroquial', ordenDelDia: ['Lectura del acta anterior', 'Cuentas'],
  estado: 'CONVOCADO', enSegunda: false, acta: '', actaAprobadaEl: null, convocatoriaId: null,
  reglas: { edadMinima: 18, antiguedadMinima: 1, quorumPrimera: 50 },
  quorum: { censoConVoto: 120, presentesConVoto: 2, necesarios: 61, enPrimera: false },
  asistentes: [
    { hermanoId: 1, nombre: 'Ana', apellidos: 'Ruiz', numeroHermano: 12, conVoto: true },
    { hermanoId: 2, nombre: 'Luis', apellidos: 'Gil', numeroHermano: 300, conVoto: false },
  ],
  votaciones: [],
}

afterEach(() => { vi.unstubAllGlobals() })

function montar(estado: unknown) {
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const ruta = String(url)
    if (ruta.endsWith('/votaciones')) {
      const v = JSON.parse(String(init.body))
      return Promise.resolve(json({ ...(estado as object), votaciones: [{ id: 9, ...v, resultado: v.aFavor > v.enContra ? 'APROBADO' : 'RECHAZADO' }] }))
    }
    if (ruta.endsWith('/celebrar')) return Promise.resolve(json({ ...(estado as object), estado: 'CELEBRADO', enSegunda: true }))
    return Promise.resolve(json(estado))
  })
  vi.stubGlobal('fetch', fetch)
  const router = createMemoryRouter([
    { path: '/cms/cabildos', element: <p>Lista de cabildos</p> },
    { path: '/cms/cabildos/:id', element: <CabildoPage /> },
  ], { initialEntries: ['/cms/cabildos/3'] })
  render(<HelmetProvider><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
  return fetch
}

describe('CabildoPage', () => {
  it('un cabildo convocado y sin asistencia se borra, preguntando antes', async () => {
    const user = userEvent.setup()
    const fetch = montar({ ...CABILDO, asistentes: [], quorum: { ...CABILDO.quorum, presentesConVoto: 0 } })
    await user.click(await screen.findByRole('button', { name: 'Borrar el cabildo' }))
    const dialogo = await screen.findByRole('dialog')
    expect(fetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false)
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar el cabildo' }))
    expect(await screen.findByText('Lista de cabildos')).toBeInTheDocument()
    expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith('/cabildos/3') && (init as RequestInit).method === 'DELETE')).toBe(true)
  })

  it('con asistencia apuntada ya no se ofrece borrarlo', async () => {
    montar(CABILDO)
    expect(await screen.findByText('Sin voto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar el cabildo' })).not.toBeInTheDocument()
  })

  it('enseña el quórum y quién no tiene voto; sin quórum en primera, solo deja celebrarlo en segunda', async () => {
    const user = userEvent.setup()
    const fetch = montar(CABILDO)
    expect(await screen.findByText(/2 presentes con voto de un censo de 120\. Para la primera convocatoria hacen falta 61/)).toBeInTheDocument()
    expect(screen.getByText('Sin voto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Celebrado en primera convocatoria' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Celebrado en segunda convocatoria' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, en segunda' }))
    await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith('/cabildos/3/celebrar') && JSON.parse(String((init as RequestInit).body)).enSegunda === true)).toBe(true))
    expect(await screen.findByText('Texto del acta')).toBeInTheDocument()
  })

  it('apunta una votación y dice si se aprueba', async () => {
    const user = userEvent.setup()
    montar(CABILDO)
    await user.type(await screen.findByLabelText('Qué se vota'), 'Cuentas del ejercicio')
    await user.type(screen.getByLabelText('A favor'), '2')
    await user.type(screen.getByLabelText('En contra'), '0')
    await user.click(screen.getByRole('button', { name: 'Apuntar' }))
    expect(await screen.findByText('Cuentas del ejercicio')).toBeInTheDocument()
    expect(screen.getByText('Aprobado')).toBeInTheDocument()
  })

  it('con el acta aprobada no se puede tocar nada', async () => {
    montar({ ...CABILDO, estado: 'ACTA_APROBADA', actaAprobadaEl: '2026-11-01T10:00:00Z', acta: '<p>Se aprueban las cuentas.</p>', quorum: { ...CABILDO.quorum, enPrimera: true } })
    expect(await screen.findByText('Se aprueban las cuentas.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Apuntar a un hermano')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apuntar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar datos' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acta en PDF' })).toBeInTheDocument()
  })
})
