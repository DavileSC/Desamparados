import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderWithProviders } from '../../../test/test-utils'
import { useContacto } from '../../../hooks/useContacto'
import DatosCorporacionPage from '../DatosCorporacionPage'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

const DATOS = {
  secretaria: { horario: 'Martes, de 19:00 a 21:00', telefono: '952 000 000', email: 'secretaria@ejemplo.es' },
  sede: { nombre: 'Parroquia de Prueba', calle: 'Calle Mayor, 1', codigoPostal: '29001', localidad: 'Málaga' },
  redes: { facebook: 'https://facebook.com/ejemplo', instagram: null, x: null, tiktok: null, youtube: null },
  privacidad: { emailDerechos: null },
}

/** El servidor: devuelve los datos y, al guardar, lo que le mandan (o el error que se le diga). */
function servidor(respuestaAlGuardar?: Response) {
  const fetch = vi.fn(async (_url: string, opciones?: RequestInit) =>
    opciones?.method === 'PUT' ? respuestaAlGuardar ?? json(JSON.parse(String(opciones.body))) : json(DATOS))
  vi.stubGlobal('fetch', fetch)
  return () => {
    const put = fetch.mock.calls.find(([, o]) => o?.method === 'PUT')
    return put ? { url: put[0], cuerpo: JSON.parse(String(put[1]!.body)) as typeof DATOS } : null
  }
}

/** Lo que enseña la web pública (el pie, los textos legales): la misma caché que lee `useContacto`. */
function TelefonoPublico() {
  return <p data-testid="telefono-publico">{useContacto()?.secretaria.telefono}</p>
}

describe('Datos de la corporación', () => {
  it('con cambios sin guardar, salir a otra pantalla o cerrar la pestaña pregunta antes', async () => {
    servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<><DatosCorporacionPage /><Link to="/cms/paginas">Páginas</Link></>, { routerDeDatos: true })
    const horario = await screen.findByRole('textbox', { name: 'Horario' }, { timeout: 5000 })
    await usuario.type(horario, ' y sábados')

    const cierre = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cierre)
    expect(cierre.defaultPrevented).toBe(true)

    await usuario.click(screen.getByRole('link', { name: 'Páginas' }))
    const aviso = await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' })
    await usuario.click(within(aviso).getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Horario' })).toHaveValue('Martes, de 19:00 a 21:00 y sábados')
  })

  it('carga los datos, guarda lo cambiado con los vacíos como null y la web lo enseña sin recargar', async () => {
    const enviado = servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<><DatosCorporacionPage /><TelefonoPublico /></>, { routerDeDatos: true })

    const telefono = await screen.findByRole('textbox', { name: 'Teléfono' }, { timeout: 5000 })
    expect(telefono).toHaveValue('952 000 000')
    expect(screen.getByRole('textbox', { name: 'Facebook' })).toHaveValue('https://facebook.com/ejemplo')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()

    await usuario.clear(telefono)
    await usuario.type(telefono, '600 111 222')
    await usuario.clear(screen.getByRole('textbox', { name: 'Horario' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(enviado()).not.toBeNull())
    expect(enviado()!.url).toMatch(/\/cms\/corporacion$/)
    expect(enviado()!.cuerpo).toEqual({ ...DATOS, secretaria: { ...DATOS.secretaria, horario: null, telefono: '600 111 222' } })
    expect(await screen.findByText(/Guardado/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByTestId('telefono-publico')).toHaveTextContent('600 111 222')
  })

  it('no deja guardar una red que no empiece por https:// ni un correo mal escrito', async () => {
    const enviado = servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true })

    const instagram = await screen.findByRole('textbox', { name: 'Instagram' }, { timeout: 5000 })
    await usuario.type(instagram, 'instagram.com/ejemplo')
    expect(screen.getByText('Tiene que empezar por https://')).toBeInTheDocument()
    await usuario.type(screen.getByRole('textbox', { name: 'Correo para ejercer los derechos' }), 'sin-arroba')
    expect(screen.getByText(/Tiene que ser un correo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(enviado()).toBeNull()
  })

  it('el error del servidor sale en su campo', async () => {
    servidor(json({ status: 'error', message: 'Error de validación', errors: [{ field: 'sede.codigoPostal', message: 'demasiado largo' }] }, 400))
    const usuario = userEvent.setup()
    renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true })

    const cp = await screen.findByRole('textbox', { name: 'Código postal' }, { timeout: 5000 })
    await usuario.clear(cp)
    await usuario.type(cp, '29002')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    const sede = screen.getByRole('region', { name: 'Sede' })
    expect(await within(sede).findByText('demasiado largo', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/sede\.codigoPostal/)
  })
})
