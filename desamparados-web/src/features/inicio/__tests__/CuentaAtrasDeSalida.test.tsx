import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import CuentaAtrasDeSalida from '../CuentaAtrasDeSalida'
import { textosDePrueba } from './ayudas'

afterEach(() => { vi.unstubAllGlobals() })

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
/** Dentro de seis días, en Madrid, para que la cuenta nunca caduque. */
const dentroDeSeis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(Date.now() + 6 * 86_400_000))
const PROXIMA = { nombre: 'Rosario vespertino', articulo: 'el', dia: dentroDeSeis, hora: '23:59' }

function servidor(cuentaAtras?: boolean) {
  const textos = textosDePrueba()
  if (cuentaAtras !== undefined) textos.hero.cuentaAtras = cuentaAtras
  const fetch = vi.fn().mockImplementation((url: unknown) =>
    Promise.resolve(String(url).includes('/salidas/proxima') ? json({ proxima: PROXIMA }) : json({ imagenes: [], textos })))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('la cuenta atrás de la portada', () => {
  it('cuenta hasta la próxima salida con días, horas, minutos y segundos, y lo dice en una frase', async () => {
    servidor()
    renderWithProviders(<CuentaAtrasDeSalida forma="franja" />, { modulos: ['procesion'] })
    expect(await screen.findByRole('region', { name: 'Cuenta atrás para el Rosario vespertino' })).toBeInTheDocument()
    expect(screen.getByText(/^Rosario vespertino · /)).toBeInTheDocument()
    expect(screen.getByText('Faltan 6 días para el Rosario vespertino.')).toBeInTheDocument()
    for (const etiqueta of ['días', 'horas', 'minutos', 'segundos']) expect(screen.getByText(etiqueta)).toBeInTheDocument()
  })

  it('con el interruptor del CMS apagado no sale', async () => {
    const fetch = servidor(false)
    renderWithProviders(<CuentaAtrasDeSalida forma="franja" />, { modulos: ['procesion'] })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    // Ni siquiera pide las salidas.
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/salidas'))).toBe(false)
  })

  it('sin Procesión no pide las salidas ni sale', async () => {
    const fetch = servidor()
    renderWithProviders(<CuentaAtrasDeSalida forma="franja" />, { modulos: [] })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/salidas'))).toBe(false)
  })
})
