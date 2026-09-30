import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import ExtractoNorma43 from '../ExtractoNorma43'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const PREVIA = {
  errores: [],
  cuentas: [{ cuenta: '••••0513', desde: '2026-09-01', hasta: '2026-09-30', movimientos: 12 }],
  devoluciones: [
    { reciboId: 41, concepto: 'Cuota 2026', importe: 36, estado: 'REMESADO', fecha: '2026-09-08', hermano: { id: 7, nombre: 'Ana', apellidos: 'Ruiz Mena', numeroHermano: 3 }, yaAplicado: false },
    { reciboId: 40, concepto: 'Cuota 2026', importe: 36, estado: 'DEVUELTO', fecha: '2026-09-08', hermano: { id: 6, nombre: 'Luis', apellidos: 'Gil', numeroHermano: 2 }, yaAplicado: true },
  ],
  cobros: [{ remesaId: 3, mensajeId: 'REMESA-000003-20260901', fechaCobro: '2026-09-01', importe: 936, fecha: '2026-09-01', yaAplicado: false }],
  dudosos: [{ linea: 14, fecha: '2026-09-10', signo: 'CARGO', importe: 18, texto: 'DEVOLUCION REC-99', motivo: 'Nombra el recibo 99, pero el importe no coincide.' }],
  ajenos: 8,
}

afterEach(() => { vi.unstubAllGlobals() })

function api(previa: unknown = PREVIA) {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(String(url).endsWith('/aplicar')
    ? json({ message: '1 recibo marcado como devuelto y 1 remesa dada por cobrada.', devueltos: 1, cobradas: 1, omitidos: [] })
    : json(previa)))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const subir = async (user: ReturnType<typeof userEvent.setup>) =>
  user.upload(screen.getByLabelText('Fichero del extracto'), new File(['11…'], 'extracto.n43', { type: 'text/plain' }))

describe('ExtractoNorma43', () => {
  it('enseña lo que hará, sin repetir lo ya aplicado, y lo aplica', async () => {
    const user = userEvent.setup()
    const fetch = api()
    const onAplicado = vi.fn()
    renderWithProviders(<ExtractoNorma43 abierto onCerrar={() => undefined} onAplicado={onAplicado} />)

    await subir(user)
    expect(await screen.findByText(/Cuenta ••••0513, del 1 sep 2026 al 30 sep 2026: 12 movimientos/)).toBeInTheDocument()
    expect(screen.getByText('1 recibo devuelto')).toBeInTheDocument()
    expect(screen.getByText(/Ruiz Mena, Ana · Cuota 2026/)).toBeInTheDocument()
    expect(screen.queryByText(/Gil, Luis/)).not.toBeInTheDocument()
    expect(screen.getByText(/REMESA-000003-20260901 · 936,00 €/)).toBeInTheDocument()
    expect(screen.getByText(/Nombra el recibo 99, pero el importe no coincide/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(onAplicado).toHaveBeenCalledWith('1 recibo marcado como devuelto y 1 remesa dada por cobrada.'))
    const aplicar = fetch.mock.calls.find(([url]) => String(url).endsWith('/norma43/aplicar'))!
    expect((aplicar[1] as RequestInit).body).toBeInstanceOf(FormData)
  })

  it('un fichero que no es un extracto no se deja aplicar', async () => {
    const user = userEvent.setup()
    api({ ...PREVIA, errores: ['Línea 1: registro de tipo «no» desconocido; no parece un fichero Norma 43.'], devoluciones: [], cobros: [], dudosos: [] })
    renderWithProviders(<ExtractoNorma43 abierto onCerrar={() => undefined} onAplicado={() => undefined} />)

    await subir(user)
    expect(await screen.findByText(/no parece un fichero Norma 43/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
  })
})
