import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import CampoPdf, { MAX_BYTES_PDF } from '../CampoPdf'

afterEach(() => { vi.unstubAllGlobals() })

const respuesta = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/** Con estado de verdad: el nombre del archivo se enseña cuando la ruta vuelve al campo. */
function ConEstado({ inicial = '', onCambio }: { inicial?: string; onCambio: (ruta: string) => void }) {
  const [valor, setValor] = useState(inicial)
  return <CampoPdf valor={valor} onCambio={(ruta) => { setValor(ruta); onCambio(ruta) }} />
}

describe('CampoPdf', () => {
  it('sube el PDF elegido, entrega su ruta relativa y enseña el nombre del archivo', async () => {
    const espia = vi.fn().mockResolvedValue(respuesta({ data: { url: 'http://localhost:3001/storage/public/abc.pdf', filename: 'abc.pdf' } }, 201))
    vi.stubGlobal('fetch', espia)
    const onCambio = vi.fn()
    renderWithProviders(<ConEstado onCambio={onCambio} />)

    await userEvent.upload(screen.getByLabelText(/subir pdf/i), new File(['%PDF-1.4'], 'Boletín 12.pdf', { type: 'application/pdf' }))

    await vi.waitFor(() => expect(onCambio).toHaveBeenCalledWith('/storage/public/abc.pdf'))
    expect(String(espia.mock.calls[0][0])).toContain('/upload/public')
    expect(await screen.findByText('Boletín 12.pdf')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /abrir el pdf/i })).toHaveAttribute('href', '/storage/public/abc.pdf')
    expect(screen.getByLabelText(/cambiar pdf/i)).toBeInTheDocument()
  })

  it('rechaza en el navegador lo que no es PDF o pasa de 20 MB, sin llamar al servidor', async () => {
    const espia = vi.fn()
    vi.stubGlobal('fetch', espia)
    const onCambio = vi.fn()
    const usuario = userEvent.setup({ applyAccept: false })
    renderWithProviders(<CampoPdf valor="" onCambio={onCambio} />)

    await usuario.upload(screen.getByLabelText(/subir pdf/i), new File([new Uint8Array(MAX_BYTES_PDF + 1)], 'enorme.pdf', { type: 'application/pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/20 MB/)

    await usuario.upload(screen.getByLabelText(/subir pdf/i), new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/tiene que ser un PDF/i)

    expect(espia).not.toHaveBeenCalled()
    expect(onCambio).not.toHaveBeenCalled()
  })

  it('un PDF que el navegador da sin tipo se sube igual: el servidor comprueba sus bytes', async () => {
    const espia = vi.fn().mockResolvedValue(respuesta({ data: { url: 'http://localhost:3001/storage/public/abc.pdf', filename: 'abc.pdf' } }, 201))
    vi.stubGlobal('fetch', espia)
    const onCambio = vi.fn()
    renderWithProviders(<CampoPdf valor="" onCambio={onCambio} />)

    await userEvent.upload(screen.getByLabelText(/subir pdf/i), new File(['%PDF-1.4'], 'acta.PDF', { type: '' }))

    await vi.waitFor(() => expect(onCambio).toHaveBeenCalledWith('/storage/public/abc.pdf'))
  })

  it('muestra el motivo si el servidor rechaza el PDF', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ error: 'El análisis antivirus no está disponible, inténtalo más tarde.' }, 503)))
    const onCambio = vi.fn()
    renderWithProviders(<CampoPdf valor="" onCambio={onCambio} />)

    await userEvent.upload(screen.getByLabelText(/subir pdf/i), new File(['%PDF'], 'acta.pdf', { type: 'application/pdf' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El análisis antivirus no está disponible, inténtalo más tarde.')
    expect(onCambio).not.toHaveBeenCalled()
  })

  it('permite quitar el PDF actual y avisa del de relleno del seed', async () => {
    const onCambio = vi.fn()
    renderWithProviders(<CampoPdf valor="/storage/public/documentos/pendiente.pdf" onCambio={onCambio} />)

    expect(screen.getByText(/pdf de relleno/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /quitar pdf/i }))
    expect(onCambio).toHaveBeenCalledWith('')
  })
})
