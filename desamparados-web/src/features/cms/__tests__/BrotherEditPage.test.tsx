import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import cmsTheme from '../../../theme/cms'
import BrotherEditPage from '../BrotherEditPage'

const ficha = {
  id: 42, nombre: 'Rocío', apellidos: 'Gómez Marín', dni: '20000001R',
  fechaNacimiento: '1985-04-12T00:00:00.000Z', email: 'demo.1@ejemplo.invalido', telefono: '600111222',
  direccion: 'Calle Victoria, 14', poblacion: 'Málaga', codigoPostal: '29012',
  activo: true, numeroHermano: 118, fechaAlta: '2019-02-10T00:00:00.000Z', fechaBaja: null,
  esTitular: true, tieneTunicaPropia: false, tunica: 'M', alturaHombro: 168, puesto: 'Nazareno de cirio',
}

function responder(cuerpo: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
}

function montar(id = 42) {
  const router = createMemoryRouter(
    [
      { path: '/cms/hermanos', element: <h1>Gestión de hermanos</h1> },
      { path: '/cms/hermanos/:id/editar', element: <BrotherEditPage /> },
    ],
    { initialEntries: [`/cms/hermanos/${id}/editar`] },
  )
  return render(<HelmetProvider><ThemeProvider theme={cmsTheme}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
}

afterEach(() => { vi.unstubAllGlobals() })

describe('BrotherEditPage', () => {
  it('enseña los datos personales, el contacto, la hermandad y la procesión', async () => {
    responder(ficha)
    montar()
    expect(await screen.findByDisplayValue('Rocío')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20000001R')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1985-04-12')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Calle Victoria, 14')).toBeInTheDocument()
    expect(screen.getByDisplayValue('29012')).toBeInTheDocument()
    expect(screen.getByDisplayValue('118')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nazareno de cirio')).toBeInTheDocument()
    expect(screen.getByDisplayValue('168')).toBeInTheDocument()
  })

  it('no enseña el listado del censo mientras se edita', async () => {
    responder(ficha)
    montar()
    await screen.findByDisplayValue('Rocío')
    expect(screen.queryByRole('heading', { name: /gestión de hermanos/i })).not.toBeInTheDocument()
  })

  it('manda solo la ficha, con las fechas en formato de día', async () => {
    responder(ficha)
    montar()
    const dni = await screen.findByLabelText('DNI')
    fireEvent.change(dni, { target: { value: '20000001X' } })

    const enviar = vi.fn().mockResolvedValue(new Response(JSON.stringify(ficha), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', enviar)

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const [, opciones] = await vi.waitFor(() => {
      expect(enviar).toHaveBeenCalled()
      return enviar.mock.calls[0]
    })
    const cuerpo = JSON.parse(opciones.body as string)
    expect(cuerpo.dni).toBe('20000001X')
    expect(cuerpo.fechaNacimiento).toBe('1985-04-12')
    expect(cuerpo.fechaAlta).toBe('2019-02-10')
    // Sin datos bancarios: no son de esta pantalla.
    expect(cuerpo).not.toHaveProperty('iban')
  })

  it('explica el fallo si la ficha no carga', async () => {
    responder({ message: 'Hermano no encontrado' }, 404)
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })
})
