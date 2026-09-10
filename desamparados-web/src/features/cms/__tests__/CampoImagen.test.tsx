import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import CampoImagen from '../CampoImagen'

afterEach(() => { vi.unstubAllGlobals() })

const respuesta = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

describe('CampoImagen', () => {
  it('sube la foto elegida y entrega su ruta al formulario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ data: { url: 'http://localhost:3001/storage/public/abc.jpg', filename: 'abc.jpg' } }, 201)))
    const onCambio = vi.fn()
    renderWithProviders(<CampoImagen valor="" onCambio={onCambio} />)

    await userEvent.upload(screen.getByLabelText(/subir foto/i), new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))

    await vi.waitFor(() => expect(onCambio).toHaveBeenCalledWith('/storage/public/abc.jpg'))
  })

  it('enseña la foto actual y permite quitarla', async () => {
    const onCambio = vi.fn()
    renderWithProviders(<CampoImagen valor="/storage/public/actual.jpg" onCambio={onCambio} />)

    expect(screen.getByRole('img', { name: /foto actual/i })).toHaveAttribute('src', '/storage/public/actual.jpg')
    await userEvent.click(screen.getByRole('button', { name: /quitar foto/i }))
    expect(onCambio).toHaveBeenCalledWith('')
  })

  it('rechaza en el navegador lo que no es una imagen o pasa de 5 MB, sin llamar al servidor', async () => {
    // Se rompe si el aviso llega tarde: el servidor lo rechazaría igual, pero tras subir 20 MB.
    const espia = vi.fn()
    vi.stubGlobal('fetch', espia)
    const onCambio = vi.fn()
    const usuario = userEvent.setup({ applyAccept: false })
    renderWithProviders(<CampoImagen valor="" onCambio={onCambio} />)

    await usuario.upload(screen.getByLabelText(/subir foto/i), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/5 MB/)

    await usuario.upload(screen.getByLabelText(/subir foto/i), new File(['%PDF'], 'boletin.pdf', { type: 'application/pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG, PNG o WebP/i)

    expect(espia).not.toHaveBeenCalled()
    expect(onCambio).not.toHaveBeenCalled()
  })

  it('muestra el motivo si el servidor rechaza la foto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ error: 'El archivo ha sido rechazado por el análisis antivirus.' }, 400)))
    const onCambio = vi.fn()
    renderWithProviders(<CampoImagen valor="" onCambio={onCambio} />)

    await userEvent.upload(screen.getByLabelText(/subir foto/i), new File(['x'], 'foto.png', { type: 'image/png' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo ha sido rechazado por el análisis antivirus.')
    expect(onCambio).not.toHaveBeenCalled()
  })
})
