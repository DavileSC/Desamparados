import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import HazteHermanoPage from '../HazteHermanoPage'

async function rellenar(datos: Partial<Record<string, string>> = {}) {
  const usuario = userEvent.setup()
  const campos: Record<string, string> = {
    Nombre: 'Juan', Apellidos: 'Pérez Ruiz', 'DNI/NIE': '12345678Z',
    Contraseña: 'Prueba-2026-Segura', 'Fecha de nacimiento': '1990-04-12',
    Email: 'juan@ejemplo.es', Teléfono: '600123456',
    Dirección: 'Calle Real 14', Ciudad: 'Málaga', 'Código postal': '29013',
    ...datos,
  }
  for (const [etiqueta, valor] of Object.entries(campos)) {
    const campo = screen.getByLabelText(etiqueta)
    await usuario.clear(campo)
    await usuario.type(campo, valor)
  }
  await usuario.click(screen.getByLabelText('Acepto la política de privacidad'))
  return usuario
}

describe('HazteHermanoPage', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('rechaza un DNI con la letra equivocada antes de enviarlo', async () => {
    // El servidor lo rechazaba con un «Error de validación» sin más: el
    // navegador daba por bueno cualquier letra.
    const enviar = vi.fn()
    vi.stubGlobal('fetch', enviar)
    renderWithProviders(<HazteHermanoPage />)
    const usuario = await rellenar({ 'DNI/NIE': '12345678A' })
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText(/la letra no corresponde/i)).toBeInTheDocument()
    expect(enviar).not.toHaveBeenCalled()
  })

  it('rechaza un teléfono que no son nueve dígitos', async () => {
    const enviar = vi.fn()
    vi.stubGlobal('fetch', enviar)
    renderWithProviders(<HazteHermanoPage />)
    const usuario = await rellenar({ Teléfono: '95212345' })
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText(/nueve d[ií]gitos/i)).toBeInTheDocument()
    expect(enviar).not.toHaveBeenCalled()
  })

  it('manda el DNI y el teléfono normalizados', async () => {
    const enviar = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 1, email: 'juan@ejemplo.es' }, message: 'ok' }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', enviar)
    renderWithProviders(<HazteHermanoPage />)
    const usuario = await rellenar({ 'DNI/NIE': '12345678-z', Teléfono: '+34 600 12 34 56' })
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(enviar).toHaveBeenCalled()
    const cuerpo = JSON.parse(enviar.mock.calls[0][1].body)
    expect(cuerpo.usuario.dni).toBe('12345678Z')
    expect(cuerpo.usuario.telefono).toBe('600123456')
  })

  it('pinta bajo su casilla el error de campo que devuelve el servidor', async () => {
    // El servidor manda { message: 'Error de validación', errors: [{field, message}] }
    // y la página solo enseñaba el message: un aviso que no dice qué corregir.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        status: 'error',
        message: 'Error de validación',
        errors: [{ field: 'usuario.dni', message: 'ese DNI ya está registrado' }],
      }), { status: 400, headers: { 'Content-Type': 'application/json' } }),
    ))
    renderWithProviders(<HazteHermanoPage />)
    const usuario = await rellenar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText('ese DNI ya está registrado')).toBeInTheDocument()
  })
})
