import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import HistoriaAdminPage, { AVISO_FOTO_SIN_ALT } from '../HistoriaAdminPage'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

/** Monta la pantalla con la respuesta a la lectura inicial y un «ok» genérico para lo que venga después. */
function montar(inicial: Response = respuesta(POR_DEFECTO.historia)) {
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
      { path: '/cms/historia', element: <HistoriaAdminPage /> },
    ],
    { initialEntries: ['/cms/historia'] },
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
    cuerpo: (llamada[1] as RequestInit | undefined)?.body,
  }))
  return { peticiones }
}

/** Como `montar()`, pero el segundo hito trae una foto sin descripción. */
async function montarConFotoSinAlt() {
  const hitos = POR_DEFECTO.historia.hitos.map((hito, i) =>
    i === 1 ? { ...hito, foto: { url: '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp', alt: '', pie: '' } } : hito)
  const { peticiones } = montar(respuesta({ ...POR_DEFECTO.historia, hitos }))
  const usuario = userEvent.setup({ delay: null })
  await screen.findByRole('button', { name: 'Guardar' })
  return { usuario, peticiones }
}

describe('HistoriaAdminPage', () => {
  it('carga los hitos de siempre', async () => {
    montar()
    expect(await screen.findByDisplayValue('La devoción crece en la parroquia')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^periodo del hito/i)).toHaveLength(5)
    expect(screen.getByLabelText('Color del hito 4')).toHaveValue('granate')
  })

  it('añade un hito al final, vacío y sin color', async () => {
    montar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByDisplayValue('La devoción crece en la parroquia')

    await usuario.click(screen.getByRole('button', { name: /añadir hito/i }))

    expect(screen.getAllByLabelText(/^periodo del hito/i)).toHaveLength(6)
    expect(screen.getByLabelText('Color del hito 6')).toHaveValue('ninguno')
  })

  it('quita un hito', async () => {
    montar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByDisplayValue('La devoción crece en la parroquia')

    await usuario.click(screen.getByRole('button', { name: /quitar el hito 1/i }))

    expect(screen.queryByDisplayValue('La devoción crece en la parroquia')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/^periodo del hito/i)).toHaveLength(4)
  })

  it('sube un hito de sitio', async () => {
    montar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByDisplayValue('La devoción crece en la parroquia')

    await usuario.click(screen.getByRole('button', { name: /subir el hito 2/i }))

    const titulos = screen.getAllByLabelText(/^título del hito/i) as HTMLInputElement[]
    expect(titulos[0].value).toBe('El culto a la Virgen, primero')
    expect(titulos[1].value).toBe('La devoción crece en la parroquia')
  })

  it('no deja guardar una foto de hito sin descripción', async () => {
    // El servidor también lo rechaza; aquí se avisa antes de enviar, y arriba
    // del todo, porque el hito puede estar fuera de la vista.
    const { usuario, peticiones } = await montarConFotoSinAlt()

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const alaVista = screen.getAllByText(AVISO_FOTO_SIN_ALT).filter((el) => !el.closest('[role="region"]'))
    expect(alaVista).toHaveLength(1)
    expect(peticiones().some((p) => p.metodo === 'PUT')).toBe(false)
  })

  it('guarda el documento entero, con los hitos sin la clave de fila', async () => {
    const { peticiones } = montar()
    const usuario = userEvent.setup({ delay: null })
    await usuario.type(await screen.findByDisplayValue('La devoción crece en la parroquia'), '!')

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => expect(peticiones()).toContainEqual(
      expect.objectContaining({ url: '/api/contenido/historia', metodo: 'PUT' })))
    const enviado = JSON.parse(String(peticiones().find((p) => p.metodo === 'PUT')!.cuerpo)).datos
    expect(enviado.hitos[0].titulo).toBe('La devoción crece en la parroquia!')
    expect(Object.keys(enviado.hitos[0]).sort()).toEqual(['etiqueta', 'foto', 'periodo', 'relato', 'titulo', 'tono'])
    expect(enviado.fondo).toEqual({ url: '/images/hero-1920.webp' })
  })

  it('sin cambios, guardar no manda nada', async () => {
    const { peticiones } = montar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByDisplayValue('La devoción crece en la parroquia')

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(peticiones().filter((p) => p.metodo === 'PUT')).toEqual([])
  })
})
