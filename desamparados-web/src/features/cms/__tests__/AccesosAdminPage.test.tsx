import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import AccesosAdminPage from '../AccesosAdminPage'

const STAFF = [
  { id: 1, email: 'admin@desamparados.test', role: 'ADMIN', nombre: 'Rocío', apellidos: 'Vega Luna', dni: '12345678Z', telefono: '600000000' },
  { id: 2, email: 'tesorero@desamparados.test', role: 'TESORERIA', nombre: 'Andrés', apellidos: 'Gil Soto', dni: '87654321X', telefono: '600000001' },
]

const CANDIDATOS = [
  { id: 9, nombre: 'Marta', apellidos: 'Ponce Rueda', dni: '11111111H', email: 'marta@ejemplo.test' },
]

/**
 * Cada ruta responde lo suyo. `apiFetch` lee el cuerpo con `res.text()`, así que
 * hay que devolver una Response nueva en cada llamada.
 */
function responder(opciones: { staff?: unknown; candidatos?: unknown; alCambiar?: () => Response } = {}) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = []
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET'
    llamadas.push({ url, metodo, cuerpo: init?.body ? JSON.parse(String(init.body)) : null })
    const json = (valor: unknown, status = 200) => Promise.resolve(new Response(
      JSON.stringify(valor), { status, headers: { 'Content-Type': 'application/json' } },
    ))
    if (url.includes('/admin/staff/promote') || url.includes('/admin/staff/demote')) {
      return Promise.resolve(opciones.alCambiar?.() ?? new Response(
        JSON.stringify({ message: 'Hecho' }), { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    }
    if (url.includes('/admin/users/search')) return json(opciones.candidatos ?? CANDIDATOS)
    return json(opciones.staff ?? STAFF)
  })
  vi.stubGlobal('fetch', simulado)
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('AccesosAdminPage', () => {
  it('enseña quién tiene acceso al CMS y con qué cargo', async () => {
    responder()
    renderWithProviders(<AccesosAdminPage />)

    expect(await screen.findByText('Rocío Vega Luna')).toBeInTheDocument()
    // El cargo va junto al correo, en la misma línea: así se distingue del
    // texto suelto de los selectores de cargo de cada fila.
    expect(screen.getByText(/Administración · admin@desamparados\.test/)).toBeInTheDocument()
    expect(screen.getByText('Andrés Gil Soto')).toBeInTheDocument()
    expect(screen.getByText(/Tesorería · tesorero@desamparados\.test/)).toBeInTheDocument()
  })

  it('al entrar no hay formulario: dar acceso está detrás de un botón', async () => {
    responder()
    renderWithProviders(<AccesosAdminPage />)

    expect(await screen.findByText('Rocío Vega Luna')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dar acceso/i })).toBeInTheDocument()
  })

  it('dar acceso busca a la persona y manda su cargo', async () => {
    const user = userEvent.setup()
    const llamadas = responder()
    renderWithProviders(<AccesosAdminPage />)

    await user.click(await screen.findByRole('button', { name: /dar acceso/i }))
    const ventana = screen.getByRole('dialog', { name: /dar acceso al cms/i })
    await user.type(within(ventana).getByLabelText(/buscar/i), 'Marta')
    await user.click(await within(ventana).findByText(/Marta Ponce Rueda/))
    await user.click(within(ventana).getByRole('button', { name: /guardar|dar acceso/i }))

    await waitFor(() => {
      const envio = llamadas.find((l) => l.url.includes('/admin/staff/promote'))
      expect(envio).toBeDefined()
      expect(envio!.cuerpo).toMatchObject({ userId: 9 })
    })
  })

  it('quitar el acceso pregunta antes, porque deja a esa persona fuera al momento', async () => {
    const user = userEvent.setup()
    const llamadas = responder()
    renderWithProviders(<AccesosAdminPage />)

    await user.click(await screen.findByRole('button', { name: /quitar el acceso a Andrés Gil Soto/i }))

    expect(llamadas.some((l) => l.url.includes('demote'))).toBe(false)
    await user.click(screen.getByRole('button', { name: /quitar acceso/i }))
    await waitFor(() => {
      const envio = llamadas.find((l) => l.url.includes('/admin/staff/demote'))
      expect(envio!.cuerpo).toMatchObject({ userId: 2 })
    })
  })

  it('el aviso del servidor se enseña tal cual: es el que explica por qué no se puede', async () => {
    const user = userEvent.setup()
    responder({
      alCambiar: () => new Response(
        JSON.stringify({ message: 'No puedes degradar al último Administrador del sistema.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    })
    renderWithProviders(<AccesosAdminPage />)

    await user.click(await screen.findByRole('button', { name: /quitar el acceso a Rocío Vega Luna/i }))
    await user.click(screen.getByRole('button', { name: /quitar acceso/i }))

    expect(await screen.findByText(/último Administrador/i)).toBeInTheDocument()
  })
})
