import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import RecorridoAdminPage, { AVISO_PLANO_SIN_ALT } from '../RecorridoAdminPage'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

/** Monta la pantalla con la respuesta a la lectura inicial y un «ok» genérico para lo que venga después. */
function montar(inicial: Response = respuesta(POR_DEFECTO.recorrido)) {
  let primera = true
  const fetchMock = vi.fn().mockImplementation(() => {
    if (primera) { primera = false; return Promise.resolve(inicial) }
    return Promise.resolve(respuesta({ message: 'ok', data: {} }))
  })
  vi.stubGlobal('fetch', fetchMock)
  // PantallaEdicion usa useBlocker, que exige un data router.
  const router = createMemoryRouter(
    [
      { path: '/cms', element: <h1>Panel</h1> },
      { path: '/cms/recorrido', element: <RecorridoAdminPage /> },
    ],
    { initialEntries: ['/cms/recorrido'] },
  )
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
  const peticiones = () => fetchMock.mock.calls.map((llamada) => ({
    url: llamada[0] as string,
    metodo: (llamada[1] as RequestInit | undefined)?.method ?? 'GET',
  }))
  return { peticiones }
}

/** Como `montar()`, pero el plano ya trae una foto sin descripción. */
async function montarConPlanoSinAlt() {
  const { peticiones } = montar(respuesta({
    ...POR_DEFECTO.recorrido,
    plano: { url: '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp', alt: '' },
  }))
  const usuario = userEvent.setup({ delay: null })
  await screen.findByRole('button', { name: 'Guardar' })
  return { usuario, peticiones }
}

describe('RecorridoAdminPage', () => {
  it('carga las paradas de siempre', async () => {
    montar()
    expect(await screen.findByDisplayValue('Plaza de la Marina')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^hora/i)).toHaveLength(9)
  })

  it('añade una parada al final', async () => {
    montar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByDisplayValue('Plaza de la Marina')

    await usuario.click(screen.getByRole('button', { name: /añadir parada/i }))

    expect(screen.getAllByLabelText(/^hora/i)).toHaveLength(10)
  })

  it('quita una parada', async () => {
    montar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByDisplayValue('Plaza de la Marina')

    await usuario.click(screen.getByRole('button', { name: /quitar la parada 4/i }))

    expect(screen.queryByDisplayValue('Plaza de la Marina')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/^hora/i)).toHaveLength(8)
  })

  it('sube una parada de sitio', async () => {
    montar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByDisplayValue('Plaza de la Marina')

    await usuario.click(screen.getByRole('button', { name: /subir la parada 2/i }))

    const lugares = screen.getAllByLabelText(/^lugar/i) as HTMLInputElement[]
    expect(lugares[0].value).toBe('Plaza de la Constitución')
  })

  it('no deja guardar un plano sin descripción', async () => {
    // El servidor también lo rechaza; aquí se avisa antes de enviar.
    const { usuario } = await montarConPlanoSinAlt()
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText(/descripción/i)).toBeInTheDocument()
  })

  it('al confirmar el diálogo, el aviso del plano sale fuera de la sección plegada', async () => {
    // El aviso del propio campo vive dentro de «Plano», que arranca plegada, y
    // lo plegado no se ve: al confirmar el diálogo no pasaba absolutamente nada
    // —ni error, ni indicador, ni mensaje— y quien editaba se quedaba mirando.
    const { usuario } = await montarConPlanoSinAlt()

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))
    // Mientras el diálogo siga montado, MUI deja el resto de la pantalla en
    // `aria-hidden`; se espera a que se vaya antes de mirar nada por rol.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Cada sección plegable es un `role="region"` del acordeón de MUI: el aviso
    // que cuenta es el que NO cuelga de ninguna, porque es el único que se ve
    // sin tener que desplegar la sección que se acaba de ignorar.
    const alaVista = screen.getAllByText(AVISO_PLANO_SIN_ALT).filter((el) => !el.closest('[role="region"]'))
    expect(alaVista).toHaveLength(1)
  })

  it('aunque se confirme el diálogo, el plano sin descripción no llega a mandarse', async () => {
    // Cierra el hueco del test de arriba: ese solo comprueba el aviso, no que
    // el envío se pare de verdad. Este sí llega hasta «Guardar cambios», que
    // es lo único que dispara `onGuardar` (el botón de arriba solo abre el diálogo).
    const { usuario, peticiones } = await montarConPlanoSinAlt()

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(peticiones().some((p) => p.metodo === 'PUT')).toBe(false)
  })

  it('con el plano descrito, el guardado sí llega al servidor', async () => {
    // El caso contrario del anterior: la guarda no debe bloquear un plano válido.
    const { peticiones } = montar(respuesta({
      ...POR_DEFECTO.recorrido,
      plano: { url: '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp', alt: 'Plano del recorrido, calle a calle' },
    }))
    const usuario = userEvent.setup({ delay: null })
    // Se retoca algo antes: desde que la pantalla no guarda documentos sin
    // cambios, un formulario recién cargado no mandaría nada y este test
    // pasaría a comprobar lo contrario de lo que dice su nombre.
    await usuario.type(await screen.findByDisplayValue('Plaza de la Marina'), '!')

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => expect(peticiones()).toContainEqual(
      expect.objectContaining({ url: '/api/contenido/recorrido', metodo: 'PUT' })))
  })

  it('guarda el documento entero', async () => {
    const { peticiones } = montar()
    const usuario = userEvent.setup({ delay: null })
    await usuario.type(await screen.findByDisplayValue('Plaza de la Marina'), '!')

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => expect(peticiones()).toContainEqual(
      expect.objectContaining({ url: '/api/contenido/recorrido', metodo: 'PUT' })))
  })

  it('sin cambios, guardar no manda nada', async () => {
    // Cada «Guardar» en balde era un PUT, un apunte de auditoría y un
    // `updatedAt` movido para dejar el documento exactamente igual que estaba.
    // La portada ya se negaba a hacerlo; esta pantalla no tenía por qué ser
    // distinta.
    const { peticiones } = montar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByDisplayValue('Plaza de la Marina')

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))
    // El diálogo tapa el resto de la pantalla con `aria-hidden` mientras siga
    // montado: sin esta espera, la comprobación de abajo no miraría nada.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(peticiones().filter((p) => p.metodo === 'PUT')).toEqual([])
  })
})
