import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import HojaCenso from '../HojaCenso'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const PREVIA = {
  filas: 5, importables: 3, conCuenta: 1, aCargo: 1, deBaja: 1, sinNumero: 2, domiciliadas: 1,
  columnas: [{ titulo: 'Nombre', clave: 'nombre' }, { titulo: 'Observaciones', clave: null }],
  errores: [{ fila: 5, errores: ['Falta el nombre.'] }, { fila: 6, errores: ['El DNI 01234567L ya está en la fila 2.'] }],
}

function api() {
  const fetch = vi.fn().mockImplementation((url: string) => {
    const ruta = String(url)
    if (ruta.includes('/censo/exportar')) return Promise.resolve(new Response('Nombre', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="censo-activos-2026-09-30.csv"' } }))
    if (ruta.endsWith('/importar/previa')) return Promise.resolve(json(PREVIA))
    return Promise.resolve(json({ message: 'Se han importado 3 fichas.', importadas: 3 }, 201))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

beforeEach(() => { vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:censo'), revokeObjectURL: vi.fn() })) })
afterEach(() => { vi.unstubAllGlobals() })

describe('HojaCenso', () => {
  it('exporta en el formato elegido, con o sin bajas', async () => {
    const user = userEvent.setup()
    const fetch = api()
    renderWithProviders(<HojaCenso onImportado={() => undefined} onError={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Exportar' }))
    await user.click(await screen.findByRole('menuitem', { name: 'CSV · con las bajas' }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(String(fetch.mock.calls[0][0])).toContain('/hermanos/admin/censo/exportar?formato=csv&bajas=si')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('enseña qué entra y qué no, y lo importa', async () => {
    const user = userEvent.setup()
    const fetch = api()
    const onImportado = vi.fn()
    renderWithProviders(<HojaCenso onImportado={onImportado} onError={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Importar' }))
    const ventana = await screen.findByRole('dialog')
    await user.upload(within(ventana).getByLabelText('Fichero del censo'), new File(['Nombre'], 'censo.csv', { type: 'text/csv' }))

    expect(await within(ventana).findByText('De 5 filas, entran 3.')).toBeInTheDocument()
    expect(within(ventana).getByText(/1 recibe su propia cuenta/)).toBeInTheDocument()
    expect(within(ventana).getByText(/1 trae el correo de otro hermano: queda en su cuenta/)).toBeInTheDocument()
    expect(within(ventana).getByText(/1 queda sin cuenta: se les da con «Emancipar»/)).toBeInTheDocument()
    expect(within(ventana).getByText(/2 activos no traen número/)).toBeInTheDocument()
    expect(within(ventana).getByText(/Columnas que no se usan: «Observaciones»/)).toBeInTheDocument()
    expect(within(ventana).getByText('Fila 5: Falta el nombre.')).toBeInTheDocument()

    await user.click(within(ventana).getByRole('button', { name: 'Importar 3 fichas' }))
    await waitFor(() => expect(onImportado).toHaveBeenCalledWith('Se han importado 3 fichas.'))
    expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith('/hermanos/admin/censo/importar') && (init as RequestInit).body instanceof FormData)).toBe(true)
  })

  // El servidor mide el .xlsx descomprimido antes de abrirlo: pasado de 50 MB
  // responde 413, y eso tiene que verse en la ventana, no quedarse en blanco.
  it('un Excel demasiado grande una vez abierto (413) se dice en la ventana', async () => {
    const user = userEvent.setup()
    const mensaje = 'El Excel es demasiado grande una vez abierto: pártelo en varios o guárdalo como CSV.'
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ error: mensaje }, 413))))
    renderWithProviders(<HojaCenso onImportado={() => undefined} onError={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Importar' }))
    const ventana = await screen.findByRole('dialog')
    await user.upload(within(ventana).getByLabelText('Fichero del censo'), new File(['PK'], 'censo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))

    expect(await within(ventana).findByText(mensaje)).toBeInTheDocument()
  })
})

