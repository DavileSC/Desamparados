import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import RecibosPage from '../RecibosPage'

// La unidad paginada es el recibo, no el miembro: cada fila llega plana y con
// el hermano al que pertenece dentro.
const recibo = {
  id: 10,
  year: 2026,
  concepto: 'Cuota anual',
  importe: 30,
  fechaEmision: '2026-01-15T00:00:00.000Z',
  fechaPago: null,
  estado: 'PENDIENTE',
  hermano: { nombre: 'Ana', apellidos: 'Pérez Ruiz', esTitular: true },
}

/**
 * Una instancia de `Response` por llamada: `llamarApi` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda.
 */
function responder(data: unknown[], meta: Record<string, number>, certificados: unknown[] = []) {
  const simulado = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(
    // Los certificados para la renta se piden aparte, debajo de la lista.
    JSON.stringify(String(url).includes('/certificados') ? { disponibles: true, certificados } : { data, meta }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

/** Las llamadas al listado, sin la de los certificados. */
const delListado = (simulado: ReturnType<typeof vi.fn>) => simulado.mock.calls.map(([u]) => String(u)).filter((u) => !u.includes('/certificados'))

afterEach(() => { vi.unstubAllGlobals() })

describe('RecibosPage', () => {
  it('ofrece el certificado de donativos de cada año cerrado', async () => {
    responder([recibo], { total: 1, page: 1, limit: 20, totalPages: 1 }, [{ ejercicio: 2025, nif: '12345678Z', nombre: 'Ana Pérez Ruiz', centimos: 3000 }])
    renderWithProviders(<RecibosPage />)
    expect(await screen.findByRole('heading', { name: 'Certificados para la renta' })).toBeInTheDocument()
    expect(screen.getByText('2025 · Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeEnabled()
  })

  // Sin el módulo del Modelo 182, el certificado para la renta no existe,
  // aunque haya donativos que lo justificarían.
  it('sin el módulo del Modelo 182, no hay apartado de certificados aunque haya donativos', async () => {
    responder([recibo], { total: 1, page: 1, limit: 20, totalPages: 1 }, [{ ejercicio: 2025, nif: '12345678Z', nombre: 'Ana Pérez Ruiz', centimos: 3000 }])
    renderWithProviders(<RecibosPage />, { modulos: ['area-hermanos'] })
    expect(await screen.findByText(/cuota anual/i)).toBeInTheDocument()
    expect(screen.queryByText('Certificados para la renta')).not.toBeInTheDocument()
  })

  it('sin donativos que certificar, no hay apartado de certificados', async () => {
    responder([recibo], { total: 1, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<RecibosPage />)
    expect(await screen.findByText(/cuota anual/i)).toBeInTheDocument()
    expect(screen.queryByText('Certificados para la renta')).not.toBeInTheDocument()
  })

  it('dice cuántos recibos propios hay', async () => {
    responder([], { total: 30, page: 1, limit: 20, totalPages: 2 })
    renderWithProviders(<RecibosPage />)
    expect(await screen.findByText(/de 30/i)).toBeInTheDocument()
  })

  it('pinta los recibos que llegan en data y ofrece pasar de página', async () => {
    const simulado = responder([recibo], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<RecibosPage />)

    expect(await screen.findByText(/cuota anual/i)).toBeInTheDocument()
    expect(screen.getByText('30,00 €')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    expect(delListado(simulado)[0]).toContain('/recibos/mis-recibos?')
  })

  it('pide la página que dice la URL', async () => {
    const simulado = responder([], { total: 45, page: 2, limit: 20, totalPages: 3 })
    renderWithProviders(<RecibosPage />, { ruta: '/area-hermano/recibos?pagina=2' })

    await waitFor(() => expect(delListado(simulado).at(-1)).toContain('page=2'))
  })

  // El arreglo del móvil: seis columnas en una tabla obligaban a arrastrar la
  // pantalla de lado para leer el importe y el estado, que están al final.
  it('no pinta una tabla, que en el móvil hay que arrastrar de lado', async () => {
    responder([recibo], { total: 1, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<RecibosPage />)

    await screen.findByText(/cuota anual/i)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('encabeza cada año una sola vez, aunque tenga varios recibos', async () => {
    responder(
      [
        { ...recibo, id: 1, year: 2026, concepto: 'Cuota anual' },
        { ...recibo, id: 2, year: 2026, concepto: 'Papeleta de sitio' },
        { ...recibo, id: 3, year: 2025, concepto: 'Cuota anual' },
      ],
      { total: 3, page: 1, limit: 20, totalPages: 1 },
    )
    renderWithProviders(<RecibosPage />)

    expect(await screen.findByRole('heading', { name: '2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2025' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: '2026' })).toHaveLength(1)
  })

  // Quien entra solo, con su cuota y su papeleta de cada año, veía su propio
  // nombre repetido en cada fila sin que aportara nada. En una familia con
  // varias fichas es justo al revés: es lo único que distingue dos recibos
  // iguales del mismo año.
  it('no repite el nombre cuando todos los recibos son de la misma persona', async () => {
    responder(
      [{ ...recibo, id: 1 }, { ...recibo, id: 2, concepto: 'Papeleta de sitio' }],
      { total: 2, page: 1, limit: 20, totalPages: 1 },
    )
    renderWithProviders(<RecibosPage />)

    await screen.findByText(/cuota anual/i)
    expect(screen.queryByText('Ana Pérez Ruiz')).not.toBeInTheDocument()
  })

  it('nombra a cada hermano cuando la familia tiene varios', async () => {
    responder(
      [
        { ...recibo, id: 1 },
        { ...recibo, id: 2, hermano: { nombre: 'Lucas', apellidos: 'Pérez Ruiz', esTitular: false } },
      ],
      { total: 2, page: 1, limit: 20, totalPages: 1 },
    )
    renderWithProviders(<RecibosPage />)

    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getByText('Lucas Pérez Ruiz')).toBeInTheDocument()
  })

  it('cada recibo enlaza con su detalle', async () => {
    responder([recibo], { total: 1, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<RecibosPage />)

    const enlace = await screen.findByRole('link', { name: /cuota anual/i })
    expect(enlace).toHaveAttribute('href', '/area-hermano/recibos/10')
  })
})
