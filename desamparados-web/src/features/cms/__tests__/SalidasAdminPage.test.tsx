import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../theme/cms'
import { useAuthStore } from '../../altas/auth/store'
import SalidasAdminPage from '../salidas/SalidasAdminPage'
import { crearSalida, salidasDelCms, type Salida } from '../../../lib/api/salidas'

// `useSalidas` (tarea 4) llama a estas funciones: se simula el módulo entero y
// no `fetch`, tal y como pide el encargo (el backend lo termina otro agente).
vi.mock('../../../lib/api/salidas', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../lib/api/salidas')>()
  return { ...real, salidasDelCms: vi.fn(), crearSalida: vi.fn(), editarSalida: vi.fn(), fijarFechaDeSalida: vi.fn() }
})

const pasion: Salida = {
  id: 1, slug: 'sabado-de-pasion', nombre: 'Sábado de Pasión', orden: 1, activa: true, conRopa: true,
  cobro: 'CUOTA', importeCuota: 0, fecha: 'PASCUA', diasDesdePascua: -8, horaSalida: '19:00', lugar: 'Templo parroquial',
  eventoId: null, plazoAbierto: true, puestos: [{ nombre: 'Nazareno', tunica: true, tocado: 'CAPIROTE', alturaHombro: false }],
  cortejo: null, indicaciones: null, anio: 2026, fechaDelAnio: '2026-03-28', acto: null,
}
const rosario: Salida = {
  id: 2, slug: 'rosario-vespertino', nombre: 'Rosario vespertino', orden: 2, activa: false, conRopa: false,
  cobro: 'DONATIVO', importeCuota: 0, fecha: 'MANUAL', diasDesdePascua: null, horaSalida: null, lugar: null,
  eventoId: null, plazoAbierto: false, puestos: [], cortejo: null, indicaciones: null, anio: 2026, fechaDelAnio: null, acto: null,
}

function montar(ruta = '/cms/procesion/salidas') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const router = createMemoryRouter(
    [
      { path: '/cms/procesion/salidas', element: <SalidasAdminPage /> },
      { path: '/cms/procesion/salidas/:id/editar', element: <div>Editando</div> },
    ],
    { initialEntries: [ruta] },
  )
  render(
    <HelmetProvider><QueryClientProvider client={cliente}><ThemeProvider theme={crearTemaCms('claro')}>
      <RouterProvider router={router} />
    </ThemeProvider></QueryClientProvider></HelmetProvider>,
  )
  return router
}

beforeEach(() => {
  useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'secre@ejemplo.es', role: 'SECRETARIA', perfiles: [], origen: 'cms' }, hermano: null })
  vi.mocked(salidasDelCms).mockResolvedValue([pasion, rosario])
})

describe('SalidasAdminPage', () => {
  it('lista las salidas por orden, con su fecha y la marca de desactivada', async () => {
    montar()
    const filas = await screen.findAllByRole('link')
    expect(filas[0]).toHaveTextContent('Sábado de Pasión')
    expect(filas[0]).toHaveTextContent('Por la Pascua: 28 de marzo de 2026')
    expect(filas[1]).toHaveTextContent('Rosario vespertino')
    expect(filas[1]).toHaveTextContent('A mano: sin fecha')
    expect(filas[1]).toHaveTextContent('Desactivada')
  })

  it('«Nueva salida» abre la ventana; el nombre propone el nombre corto y al guardar crea y navega a editar', async () => {
    const usuario = userEvent.setup()
    vi.mocked(crearSalida).mockResolvedValue({
      ...pasion, id: 42, slug: 'traslado', nombre: 'Traslado', diasDesdePascua: -3, fechaDelAnio: '2026-04-02',
    })
    const router = montar()
    await screen.findByText('Sábado de Pasión')

    await usuario.click(screen.getByRole('button', { name: 'Nueva salida' }))
    expect(screen.getByRole('dialog', { name: 'Nueva salida' })).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Nombre'), 'Traslado')
    expect(screen.getByLabelText('Nombre corto (en la dirección)')).toHaveValue('traslado')

    await usuario.type(screen.getByLabelText('Días desde el Domingo de Resurrección'), '-3')
    // Sin primer puesto no se puede crear: la API exige al menos uno.
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled()
    await usuario.type(screen.getByLabelText(/Primer puesto/), 'Acompañante')
    await usuario.click(screen.getByRole('button', { name: 'Crear' }))

    expect(await screen.findByText('Editando')).toBeInTheDocument()
    expect(crearSalida).toHaveBeenCalledTimes(1)
    const datos = vi.mocked(crearSalida).mock.calls[0][0]
    expect(datos.fecha).toBe('PASCUA')
    expect(datos.diasDesdePascua).toBe(-3)
    // Detrás de la última: con las sembradas (1 y 2), el 3; contarlas daría 2, repetido.
    expect(datos.orden).toBe(3)
    expect(datos.puestos).toEqual([{ nombre: 'Acompañante', tunica: false, tocado: null, alturaHombro: false }])
    expect(router.state.location.pathname).toBe('/cms/procesion/salidas/42/editar')
  })
})
