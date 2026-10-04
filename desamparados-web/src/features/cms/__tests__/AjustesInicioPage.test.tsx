import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import AjustesInicioPage from '../AjustesInicioPage'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

/** Una fecha `AAAA-MM-DD` a tantos días de hoy, para que la cuenta atrás no caduque. */
const enDias = (n: number) => {
  const f = new Date()
  f.setDate(f.getDate() + n)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}
const OPCIONES = {
  proxima: { nombre: 'Rosario vespertino', articulo: 'el', fecha: enDias(6) },
  salidas: [{ id: 1, nombre: 'Sábado de Pasión', articulo: 'el', fecha: enDias(160) }, { id: 2, nombre: 'Rosario vespertino', articulo: 'el', fecha: enDias(6) }],
  actos: [{ id: 9, nombre: 'Solemne Triduo', fecha: enDias(40) }],
}
const AJUSTES = { foto: '/storage/public/abc.webp', x: 40, y: 30, tiempos: [], cuenta: { tipo: 'proxima' }, opciones: OPCIONES }

/** El servidor: devuelve los ajustes y, al guardar, lo que le mandan con sus opciones. */
function servidor(ajustes: Record<string, unknown> = AJUSTES) {
  const fetch = vi.fn(async (_url: string, opciones?: RequestInit) =>
    opciones?.method === 'PUT' ? json({ ...JSON.parse(String(opciones.body)), opciones: OPCIONES }) : json(ajustes))
  vi.stubGlobal('fetch', fetch)
  return () => {
    const put = fetch.mock.calls.find(([, o]) => o?.method === 'PUT')
    return put ? JSON.parse(String(put[1]!.body)) as Record<string, unknown> : null
  }
}

describe('Ajustes del Inicio', () => {
  it('enseña la foto guardada con su punto y la guarda al moverlo con las flechas', async () => {
    const enviado = servidor()
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

    await waitFor(() => expect(enviado()).not.toBeNull())
    expect(enviado()).toEqual({ foto: '/storage/public/abc.webp', x: 42, y: 32, tiempos: [], cuenta: { tipo: 'proxima' } })
    expect(await screen.findByText(/Guardado/)).toBeInTheDocument()
  })

  it('la cuenta atrás: dice cuál es la próxima salida y se cambia a un acto de la Agenda', async () => {
    const enviado = servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<AjustesInicioPage />)
    expect(await screen.findByText(/^Ahora: Rosario vespertino/)).toBeInTheDocument()
    expect(screen.getAllByText('para el Rosario vespertino').length).toBeGreaterThan(0)

    await usuario.click(screen.getByRole('radio', { name: /Un acto de la Agenda/ }))
    expect(screen.getAllByText('Solemne Triduo').length).toBeGreaterThan(0)
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(enviado()?.cuenta).toEqual({ tipo: 'acto', eventoId: 9 }))
  })

  it('sin Procesión no se ofrecen las salidas', async () => {
    servidor({ ...AJUSTES, cuenta: { tipo: 'ninguna' }, opciones: { ...OPCIONES, proxima: null, salidas: null } })
    renderWithProviders(<AjustesInicioPage />)
    expect(await screen.findByRole('radio', { name: /La próxima salida/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Una salida concreta/ })).toBeDisabled()
    expect(screen.getAllByText('Procesión está apagada.').length).toBe(2)
  })

  it('un tiempo nuevo no se guarda sin foto, y se puede quitar', async () => {
    servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<AjustesInicioPage />)
    await usuario.click(await screen.findByRole('button', { name: 'Añadir un tiempo' }))
    await usuario.click(screen.getByRole('menuitem', { name: 'Navidad' }))
    expect(screen.getByText('Este tiempo aún no tiene foto.')).toBeInTheDocument()
    expect(screen.getByText('Falta la foto de «Navidad».')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()

    // La Navidad ya está: no se puede añadir otra vez.
    await usuario.click(screen.getByRole('button', { name: 'Añadir un tiempo' }))
    expect(screen.getByRole('menuitem', { name: /Navidad/ })).toHaveAttribute('aria-disabled', 'true')
    await usuario.keyboard('{Escape}')

    await usuario.click(screen.getByRole('button', { name: 'Quitar Navidad' }))
    expect(screen.queryByText('Falta la foto de «Navidad».')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('el tiempo que toca hoy lleva «En uso hoy»', async () => {
    const hoy = new Date()
    const mes = String(hoy.getMonth() + 1).padStart(2, '0')
    const dia = String(hoy.getDate()).padStart(2, '0')
    const deHoy = { tiempo: 'a-mano', nombre: 'Hoy mismo', desde: `${mes}-${dia}`, hasta: `${mes}-${dia}`, foto: '/storage/public/def.webp', x: 50, y: 30 }
    servidor({ ...AJUSTES, tiempos: [deHoy] })
    renderWithProviders(<AjustesInicioPage />)
    const fila = await screen.findByRole('button', { name: 'Hoy mismo: cambiar su foto o su encuadre' })
    expect(fila).toHaveTextContent('En uso hoy')
  })

  it('«Volver a la de siempre» quita la foto y deja el encuadre de siempre', async () => {
    servidor({ ...AJUSTES, y: 60 })
    renderWithProviders(<AjustesInicioPage />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Volver a la de siempre' }))
    expect(screen.getByRole('img', { name: 'Foto del retablo' })).toHaveAttribute('src', '/images/hero-960.webp')
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '50 % desde la izquierda, 30 % desde arriba')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })
})
