import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import AjustesInicioPage from '../AjustesInicioPage'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

describe('Ajustes del Inicio', () => {
  it('enseña la foto guardada con su punto y la guarda al moverlo con las flechas', async () => {
    const fetch = vi.fn(async (_url: string, opciones?: RequestInit) =>
      opciones?.method === 'PUT' ? json(JSON.parse(String(opciones.body))) : json({ foto: '/storage/public/abc.webp', x: 40, y: 30 }))
    vi.stubGlobal('fetch', fetch)
    const usuario = userEvent.setup()
    renderWithProviders(<AjustesInicioPage />)

    const punto = await screen.findByRole('slider', { name: 'Punto de la foto que no se recorta' })
    expect(screen.getByRole('img', { name: 'Foto del retablo' })).toHaveAttribute('src', '/storage/public/abc.webp')
    expect(punto).toHaveAttribute('aria-valuetext', '40 % desde la izquierda, 30 % desde arriba')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()

    punto.focus()
    await usuario.keyboard('{ArrowRight}{ArrowDown}')
    expect(punto).toHaveAttribute('aria-valuetext', '42 % desde la izquierda, 32 % desde arriba')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/panel\/retablo$/), expect.objectContaining({ method: 'PUT' })))
    const put = fetch.mock.calls.find(([, o]) => o?.method === 'PUT')!
    expect(JSON.parse(String(put[1]!.body))).toEqual({ foto: '/storage/public/abc.webp', x: 42, y: 32 })
    expect(await screen.findByText(/Guardado/)).toBeInTheDocument()
  })

  it('«Volver a la de siempre» quita la foto y deja el encuadre de siempre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ foto: '/storage/public/abc.webp', x: 40, y: 60 })))
    renderWithProviders(<AjustesInicioPage />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Volver a la de siempre' }))
    expect(screen.getByRole('img', { name: 'Foto del retablo' })).toHaveAttribute('src', '/images/hero-960.webp')
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '50 % desde la izquierda, 30 % desde arriba')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })
})
