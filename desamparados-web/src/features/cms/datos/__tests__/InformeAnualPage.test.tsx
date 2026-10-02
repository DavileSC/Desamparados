import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../../test/test-utils'
import { useAuthStore } from '../../../altas/auth/store'
import InformeAnualPage, { anioPorDefecto, puedeEscribir } from '../InformeAnualPage'
import type { TextosInforme } from '../../../../lib/api/datos'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const VACIA: TextosInforme = { presentacion: null, firmaPresentacion: null, lugarFecha: null, epilogo: null, firmaEpilogo: null, notaPatrimonio: null, fechaCabildo: null }
const informe = (textos = VACIA) => ({
  anio: 2025, desde: '2025-01-01', hasta: '2025-12-31', textos,
  faltan: [...(textos.presentacion ? [] : ['presentacion']), ...(textos.epilogo ? [] : ['epilogo'])], actualizada: null,
})

function entrarComo(role: string) {
  useAuthStore.setState({ cms: { id: 1, role, nombre: 'Prueba' } } as never)
}

const pintar = (modulos?: string[]) =>
  renderWithProviders(<Routes><Route path="/cms/informe-anual/:anio" element={<InformeAnualPage />} /></Routes>, { ruta: '/cms/informe-anual/2025', modulos })

beforeEach(() => entrarComo('HERMANO_MAYOR'))
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('el Informe anual', () => {
  it('lo que se escribe se guarda solo y el texto sigue en pantalla', async () => {
    const fetch = vi.fn(async (_url: string, opciones?: RequestInit) =>
      opciones?.method === 'PUT' ? json(informe({ ...VACIA, ...JSON.parse(String(opciones.body)) })) : json(informe()))
    vi.stubGlobal('fetch', fetch)
    const usuario = userEvent.setup()
    pintar()

    const texto = await screen.findByRole('textbox', { name: 'Texto de la presentación' })
    expect(screen.getByRole('button', { name: 'Generar PDF' })).toBeDisabled()
    await usuario.type(texto, 'Queridos hermanos')

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/datos\/informe-anual\/2025$/), expect.objectContaining({ method: 'PUT' })), { timeout: 3000 })
    const put = fetch.mock.calls.find(([, o]) => o?.method === 'PUT')!
    expect(JSON.parse(String(put[1]!.body))).toEqual({ presentacion: 'Queridos hermanos' })
    await waitFor(() => expect(screen.getByText(/Guardado/)).toBeInTheDocument())
    expect(texto).toHaveValue('Queridos hermanos')
    expect(screen.getByRole('button', { name: /Presentación del Hermano Mayor/ })).toHaveTextContent('escrito')
  })

  it('con los dos textos escritos se puede generar el definitivo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(informe({ ...VACIA, presentacion: 'Hola', epilogo: 'Doy fe' }))))
    pintar()
    expect(await screen.findByRole('button', { name: 'Generar PDF' })).toBeEnabled()
  })

  it('Secretaría abre su epílogo y no puede tocar la presentación', async () => {
    entrarComo('SECRETARIA')
    vi.stubGlobal('fetch', vi.fn(async () => json(informe())))
    const usuario = userEvent.setup()
    pintar()

    expect(await screen.findByRole('textbox', { name: 'Texto del epílogo' })).toBeEnabled()
    await usuario.click(screen.getByRole('button', { name: /Presentación del Hermano Mayor/ }))
    expect(screen.getByRole('textbox', { name: 'Texto de la presentación' })).toBeDisabled()
    expect(screen.getByText(/la escriben el Hermano Mayor o Administración/)).toBeInTheDocument()
  })

  it('cada cargo escribe lo suyo, y hasta marzo se abre el año anterior', () => {
    expect(puedeEscribir('SECRETARIA', 'epilogo')).toBe(true)
    expect(puedeEscribir('SECRETARIA', 'presentacion')).toBe(false)
    expect(puedeEscribir('HERMANO_MAYOR', 'fechaCabildo')).toBe(true)
    expect(anioPorDefecto(new Date(2026, 2, 31, 20))).toBe(2025)
    expect(anioPorDefecto(new Date(2026, 3, 1, 9))).toBe(2026)
  })

  it('sin Agenda, Procesión ni Inventario, sus capítulos no salen y el resto se renumera como en el PDF', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(informe())))
    pintar(['informe-anual'])

    const nav = await screen.findByRole('navigation', { name: 'Capítulos del Informe anual' })
    expect(within(nav).queryByText('Cultos y actos')).not.toBeInTheDocument()
    expect(within(nav).queryByText('Sábado de Pasión y Rosario')).not.toBeInTheDocument()
    expect(within(nav).queryByText('Patrimonio')).not.toBeInTheDocument()

    const numeroDe = (titulo: string) => within(nav).getByText(titulo).previousElementSibling?.textContent
    expect(numeroDe('Presentación del Hermano Mayor')).toBe('I')
    expect(numeroDe('El año de un vistazo')).toBe('II')
    expect(numeroDe('Hermanos')).toBe('III')
    expect(numeroDe('Cuentas')).toBe('IV')
    expect(numeroDe('Comunicación')).toBe('V')
  })

  it('con todo encendido, la numeración es la de siempre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(informe())))
    pintar()

    const nav = await screen.findByRole('navigation', { name: 'Capítulos del Informe anual' })
    const numeroDe = (titulo: string) => within(nav).getByText(titulo).previousElementSibling?.textContent
    expect(numeroDe('Hermanos')).toBe('IV')
    expect(within(nav).getByText('Patrimonio')).toBeInTheDocument()
  })
})
