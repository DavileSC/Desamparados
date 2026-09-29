import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import DatosInformesPage, { escribirCifra } from '../DatosInformesPage'
import type { AreaDato, DatosResponse } from '../../../../lib/api/datos'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const area = (clave: AreaDato['clave'], nombre: string, informe: string, etiquetas: string[]): AreaDato => ({
  clave, nombre, informe,
  cifras: etiquetas.map((etiqueta, i) => ({
    etiqueta, valor: 10 + i, formato: 'numero', nota: `nota de ${etiqueta}`,
    grafica: { titulo: `Gráfica de ${etiqueta}`, resumen: 'resumen', cuerpo: { tipo: 'barras', colores: ['oro'], filas: [{ etiqueta: 'Fila', valores: [3], nota: '3' }] } },
  })),
})

const DATOS: DatosResponse = {
  generadoEn: '2026-09-29T12:00:00Z',
  periodo: { clave: 'curso-2026', tipo: 'curso', anio: 2026, etiqueta: 'Curso 2026–2027', desde: '2026-03-29', hasta: '2027-03-20', enCurso: true, anioPasion: 2027, anioRosario: 2026, meses: ['2026-03'] },
  periodos: [{ clave: 'curso-2026', etiqueta: 'Curso 2026–2027' }, { clave: 'ejercicio-2026', etiqueta: 'Ejercicio 2026' }],
  areas: [
    area('hermanos', 'Hermanos', 'Informe de hermanos', ['Hermanos activos', 'Altas', 'Bajas', 'Edad media']),
    area('dinero', 'Dinero', 'Informe de cuentas', ['Resultado', 'Ingresos', 'Gastos', 'Por cobrar']),
  ],
}

afterEach(() => { vi.unstubAllGlobals() })

describe('Datos e informes', () => {
  it('cada pestaña trae sus cuatro cifras y cada cifra cambia la gráfica', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(DATOS)))
    const usuario = userEvent.setup()
    renderWithProviders(<DatosInformesPage />, { ruta: '/cms/datos' })

    expect(await screen.findByRole('heading', { name: 'Gráfica de Hermanos activos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Informe de hermanos · PDF' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /Edad media/ }))
    expect(screen.getByRole('heading', { name: 'Gráfica de Edad media' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Dinero' }))
    expect(screen.getByRole('tab', { name: 'Dinero' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Gráfica de Resultado' })).toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Informe de cuentas · PDF' })).toBeInTheDocument()
  })

  it('el informe de la pestaña se pide con su periodo', async () => {
    const fetch = vi.fn(async (url: string) =>
      String(url).includes('/informe/')
        ? new Response(new Blob(['%PDF-']), { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="informe.pdf"' } })
        : json(DATOS))
    vi.stubGlobal('fetch', fetch)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    renderWithProviders(<DatosInformesPage />, { ruta: '/cms/datos' })

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Informe de hermanos · PDF' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/datos\/informe\/hermanos\?periodo=curso-2026$/), expect.anything()))
  })

  it('las cifras se escriben como en el PDF', () => {
    expect(escribirCifra({ valor: 4864, formato: 'diferencia-euros' })).toMatch(/^\+4\.864\s€$/)
    expect(escribirCifra({ valor: -3, formato: 'diferencia' })).toBe('−3')
    expect(escribirCifra({ valor: 41.9, formato: 'decimal' })).toBe('41,9')
  })
})
