import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../theme/cms'
import { useAuthStore } from '../../altas/auth/store'
import SalidasAdminPage from '../salidas/SalidasAdminPage'
import SalidaEditPage from '../salidas/SalidaEditPage'
import { crearSalida, editarSalida, fijarFechaDeSalida, salidasDelCms, type Salida } from '../../../lib/api/salidas'

// `useSalidas` (tarea 4) llama a estas funciones: se simula el módulo entero y
// no `fetch`, tal y como pide el encargo (el backend lo termina otro agente).
vi.mock('../../../lib/api/salidas', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../lib/api/salidas')>()
  return { ...real, salidasDelCms: vi.fn(), crearSalida: vi.fn(), editarSalida: vi.fn(), fijarFechaDeSalida: vi.fn() }
})

const pasion: Salida = {
  id: 1, slug: 'sabado-de-pasion', nombre: 'Sábado de Pasión', articulo: 'el', orden: 1, activa: true, conRopa: true,
  cobro: 'CUOTA', importeCuota: 0, fecha: 'PASCUA', diasDesdePascua: -8, horaSalida: '19:00', lugar: 'Templo parroquial',
  eventoId: null, plazoAbierto: true, puestos: [{ nombre: 'Nazareno', tunica: true, tocado: 'CAPIROTE', alturaHombro: false }],
  cortejo: null, indicaciones: null, anio: 2026, fechaDelAnio: '2026-03-28', acto: null,
}
const rosario: Salida = {
  id: 2, slug: 'rosario-vespertino', nombre: 'Rosario vespertino', articulo: 'el', orden: 2, activa: false, conRopa: false,
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

/** La ficha de edición, con su ruta real: la ventana no tiene suficiente para enseñar la vista previa. */
function montarFicha(id: number, cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })) {
  const router = createMemoryRouter(
    [
      { path: '/cms/procesion/salidas', element: <div>Listado de salidas</div> },
      { path: '/cms/procesion/salidas/:id/editar', element: <SalidaEditPage /> },
    ],
    { initialEntries: [`/cms/procesion/salidas/${id}/editar`] },
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
    // «el» por defecto: la gran mayoría de las salidas lo son.
    expect(datos.articulo).toBe('el')
    // Detrás de la última: con las sembradas (1 y 2), el 3; contarlas daría 2, repetido.
    expect(datos.orden).toBe(3)
    expect(datos.puestos).toEqual([{ nombre: 'Acompañante', tunica: false, tocado: null, alturaHombro: false }])
    expect(router.state.location.pathname).toBe('/cms/procesion/salidas/42/editar')
  })
})

describe('SalidaEditPage', () => {
  it('la sección Datos enseña la vista previa de la papeleta con el artículo de la salida', async () => {
    const magna: Salida = { ...pasion, id: 3, slug: 'procesion-magna', nombre: 'Procesión Magna', articulo: 'la' }
    vi.mocked(salidasDelCms).mockResolvedValue([pasion, rosario, magna])

    montarFicha(3)

    expect(await screen.findByText('Papeleta de la Procesión Magna')).toBeInTheDocument()
  })

  it('la fecha a mano se guarda en hora de Madrid aunque el equipo esté en otra zona', async () => {
    const zona = process.env.TZ
    process.env.TZ = 'America/Argentina/Buenos_Aires'
    try {
      vi.mocked(fijarFechaDeSalida).mockResolvedValue({ fechaDelAnio: '2026-10-17', acto: null } as never)
      const user = userEvent.setup()
      montarFicha(2)
      const seccion = (await screen.findByRole('heading', { name: 'Fecha' })).closest('section')!
      fireEvent.change(within(seccion).getByLabelText('Día y hora'), { target: { value: '2026-10-17T19:30' } })
      await user.click(within(seccion).getByRole('button', { name: 'Guardar' }))
      // 19:30 de Madrid en octubre (verano, UTC+2) son las 17:30 UTC; tomado en
      // Buenos Aires (UTC−3) serían las 22:30.
      await waitFor(() => expect(fijarFechaDeSalida).toHaveBeenCalledWith(2, { inicio: '2026-10-17T17:30:00.000Z', lugar: null }))
    } finally {
      process.env.TZ = zona
    }
  })

  it('cambiar la fecha hace que la portada vuelva a pedir la agenda y la cuenta atrás', async () => {
    vi.mocked(fijarFechaDeSalida).mockResolvedValue({ fechaDelAnio: '2026-10-17', acto: null } as never)
    // Lo que la portada tenía en caché, de antes del cambio.
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    cliente.setQueryData(['home', 'proxima-salida'], { fecha: 'vieja' })
    cliente.setQueryData(['home', 'agenda', 'proximos'], [])
    const user = userEvent.setup()
    montarFicha(2, cliente)
    const seccion = (await screen.findByRole('heading', { name: 'Fecha' })).closest('section')!
    fireEvent.change(within(seccion).getByLabelText('Día y hora'), { target: { value: '2026-10-17T19:30' } })
    await user.click(within(seccion).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(cliente.getQueryState(['home', 'proxima-salida'])?.isInvalidated).toBe(true))
    expect(cliente.getQueryState(['home', 'agenda', 'proximos'])?.isInvalidated).toBe(true)
  })

  it('con solicitudes sin recoger, avisa al cambiar el cobro, no antes', async () => {
    vi.mocked(salidasDelCms).mockResolvedValue([{ ...pasion, solicitudesPendientes: 3 }, rosario])
    const user = userEvent.setup()
    montarFicha(1)
    const seccion = (await screen.findByRole('heading', { name: 'Cobro' })).closest('section')!
    expect(within(seccion).queryByText(/sin recoger/)).not.toBeInTheDocument()
    await user.click(within(seccion).getByRole('radio', { name: 'Donativo' }))
    expect(within(seccion).getByText(/Hay 3 solicitudes sin recoger de 2026, con el cobro de antes/)).toBeInTheDocument()
  })

  it('las papeletas ya sacadas también cuentan en el aviso, y dice a quién escribir', async () => {
    vi.mocked(salidasDelCms).mockResolvedValue([{ ...pasion, solicitudesPendientes: 1, papeletasDelAnio: 40 }, rosario])
    const user = userEvent.setup()
    montarFicha(1)
    const seccion = (await screen.findByRole('heading', { name: 'Fecha' })).closest('section')!
    await user.click(within(seccion).getByRole('radio', { name: 'A mano' }))
    expect(within(seccion).getByText(/Hay 1 solicitud sin recoger y 40 papeletas ya sacadas de 2026, con la fecha de antes/)).toBeInTheDocument()
    expect(within(seccion).getByText(/«Apuntados al Sábado de Pasión»/)).toBeInTheDocument()
  })

  it('solo con papeletas ya sacadas (el plazo cerrado), también avisa', async () => {
    vi.mocked(salidasDelCms).mockResolvedValue([{ ...pasion, papeletasDelAnio: 2 }, rosario])
    const user = userEvent.setup()
    montarFicha(1)
    const seccion = (await screen.findByRole('heading', { name: 'Cobro' })).closest('section')!
    await user.click(within(seccion).getByRole('radio', { name: 'Donativo' }))
    expect(within(seccion).getByText(/Hay 2 papeletas ya sacadas de 2026/)).toBeInTheDocument()
  })

  it('pasar de la Pascua a una fecha a mano es una sola llamada, con aMano', async () => {
    vi.mocked(editarSalida).mockClear()
    vi.mocked(fijarFechaDeSalida).mockResolvedValue({ fechaDelAnio: '2026-10-17', acto: null } as never)
    const user = userEvent.setup()
    montarFicha(1)
    const seccion = (await screen.findByRole('heading', { name: 'Fecha' })).closest('section')!
    await user.click(within(seccion).getByRole('radio', { name: 'A mano' }))
    fireEvent.change(within(seccion).getByLabelText('Día y hora'), { target: { value: '2026-10-17T19:30' } })
    await user.click(within(seccion).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(fijarFechaDeSalida).toHaveBeenCalledWith(1, { inicio: '2026-10-17T17:30:00.000Z', lugar: null, aMano: true }))
    expect(editarSalida).not.toHaveBeenCalled()
  })

  it('el 409 de la fecha sale en la sección', async () => {
    vi.mocked(fijarFechaDeSalida).mockRejectedValue(new Error('Con el plazo abierto, la fecha tiene que ser de 2026.'))
    const user = userEvent.setup()
    montarFicha(1)
    const seccion = (await screen.findByRole('heading', { name: 'Fecha' })).closest('section')!
    await user.click(within(seccion).getByRole('radio', { name: 'A mano' }))
    fireEvent.change(within(seccion).getByLabelText('Día y hora'), { target: { value: '2027-10-17T19:30' } })
    await user.click(within(seccion).getByRole('button', { name: 'Guardar' }))
    expect(await within(seccion).findByText('Con el plazo abierto, la fecha tiene que ser de 2026.')).toBeInTheDocument()
  })

  it('sin solicitudes sin recoger, cambiar la fecha no avisa', async () => {
    const user = userEvent.setup()
    montarFicha(1)
    const seccion = (await screen.findByRole('heading', { name: 'Fecha' })).closest('section')!
    await user.click(within(seccion).getByRole('radio', { name: 'A mano' }))
    expect(within(seccion).queryByText(/sin recoger/)).not.toBeInTheDocument()
  })

  it('con una sección a medias, «Volver» pregunta antes de perder los cambios', async () => {
    const user = userEvent.setup()
    montarFicha(1)
    await user.type(await screen.findByRole('textbox', { name: 'Indicaciones' }), 'Traje oscuro')
    await user.click(screen.getByRole('link', { name: 'Volver' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/cambios que has hecho en esta salida/)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Indicaciones' })).toHaveValue('Traje oscuro')
    expect(screen.queryByText('Listado de salidas')).not.toBeInTheDocument()
  })
})
