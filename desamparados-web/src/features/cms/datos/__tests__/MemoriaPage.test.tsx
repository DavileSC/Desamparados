import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../../test/test-utils'
import { useAuthStore } from '../../../altas/auth/store'
import MemoriaPage, { cursoDeHoy, puedeEscribir } from '../MemoriaPage'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const VACIA = { presentacion: null, firmaPresentacion: null, lugarFecha: null, epilogo: null, firmaEpilogo: null, notaPatrimonio: null, fechaCabildo: null }
const memoria = (textos = VACIA) => ({
  curso: 2025, etiqueta: 'Curso 2025–2026', desde: '2025-04-13', hasta: '2026-03-28', textos,
  faltan: [...(textos.presentacion ? [] : ['presentacion']), ...(textos.epilogo ? [] : ['epilogo'])], actualizada: null,
})

function entrarComo(role: string) {
  useAuthStore.setState({ cms: { id: 1, role, nombre: 'Prueba' } } as never)
}

const pintar = () => renderWithProviders(<Routes><Route path="/cms/memoria/:curso" element={<MemoriaPage />} /></Routes>, { ruta: '/cms/memoria/2025' })

beforeEach(() => entrarComo('HERMANO_MAYOR'))
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('la Memoria del curso', () => {
  it('lo que se escribe se guarda solo y el texto sigue en pantalla', async () => {
    const fetch = vi.fn(async (_url: string, opciones?: RequestInit) =>
      opciones?.method === 'PUT' ? json(memoria({ ...VACIA, ...JSON.parse(String(opciones.body)) })) : json(memoria()))
    vi.stubGlobal('fetch', fetch)
    const usuario = userEvent.setup()
    pintar()

    const texto = await screen.findByRole('textbox', { name: 'Texto de la presentación' })
    expect(screen.getByRole('button', { name: 'Generar PDF' })).toBeDisabled()
    await usuario.type(texto, 'Queridos hermanos')

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/datos\/memoria\/2025$/), expect.objectContaining({ method: 'PUT' })), { timeout: 3000 })
    const put = fetch.mock.calls.find(([, o]) => o?.method === 'PUT')!
    expect(JSON.parse(String(put[1]!.body))).toEqual({ presentacion: 'Queridos hermanos' })
    await waitFor(() => expect(screen.getByText(/Guardado/)).toBeInTheDocument())
    expect(texto).toHaveValue('Queridos hermanos')
    expect(screen.getByRole('button', { name: /Presentación del Hermano Mayor/ })).toHaveTextContent('escrito')
  })

  it('con los dos textos escritos se puede generar la definitiva', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(memoria({ ...VACIA, presentacion: 'Hola', epilogo: 'Doy fe' }))))
    pintar()
    expect(await screen.findByRole('button', { name: 'Generar PDF' })).toBeEnabled()
  })

  it('Secretaría abre su epílogo y no puede tocar la presentación', async () => {
    entrarComo('SECRETARIA')
    vi.stubGlobal('fetch', vi.fn(async () => json(memoria())))
    const usuario = userEvent.setup()
    pintar()

    expect(await screen.findByRole('textbox', { name: 'Texto del epílogo' })).toBeEnabled()
    await usuario.click(screen.getByRole('button', { name: /Presentación del Hermano Mayor/ }))
    expect(screen.getByRole('textbox', { name: 'Texto de la presentación' })).toBeDisabled()
    expect(screen.getByText(/la escriben el Hermano Mayor o Administración/)).toBeInTheDocument()
  })

  it('cada cargo escribe lo suyo, y el curso cambia el día después del Sábado de Pasión', () => {
    expect(puedeEscribir('SECRETARIA', 'epilogo')).toBe(true)
    expect(puedeEscribir('SECRETARIA', 'presentacion')).toBe(false)
    expect(puedeEscribir('HERMANO_MAYOR', 'fechaCabildo')).toBe(true)
    // Sábado de Pasión de 2026: 28 de marzo.
    expect(cursoDeHoy(new Date(2026, 2, 28, 20))).toBe(2025)
    expect(cursoDeHoy(new Date(2026, 2, 29, 9))).toBe(2026)
  })
})
