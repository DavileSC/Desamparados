import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ContactoPage from '../ContactoPage'
import { contactSchema, telefonoValido } from '../schema'
import { stubFetchPublico } from '../../../test/fetchPublico'

afterEach(() => { vi.unstubAllGlobals() })

function responderBien() {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ message: 'Mensaje enviado correctamente.' }), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  stubFetchPublico(simulado)
  return simulado
}

async function rellenar(usuario: ReturnType<typeof userEvent.setup>, { email = 'ana@example.es', telefono = '' } = {}) {
  // El formulario llega con el documento de la página: primero su esqueleto.
  await usuario.type(await screen.findByLabelText('Nombre'), 'Ana')
  await usuario.type(screen.getByLabelText('Email'), email)
  if (telefono) await usuario.type(screen.getByLabelText(/teléfono/i), telefono)
  await usuario.type(screen.getByLabelText('Asunto'), 'Besapiés')
  await usuario.type(screen.getByLabelText('Mensaje'), 'Quería preguntar por el horario del besapiés.')
}

describe('ContactoPage', () => {
  it('envía sin teléfono, con el campo trampa vacío y el tiempo que se ha tardado en rellenarlo', async () => {
    const usuario = userEvent.setup()
    const simulado = responderBien()
    renderWithProviders(<ContactoPage />)

    await rellenar(usuario)
    await usuario.click(screen.getByRole('button', { name: /enviar mensaje/i }))

    expect(await screen.findByText(/mensaje enviado correctamente/i)).toBeInTheDocument()
    const [url, init] = simulado.mock.calls[0]
    expect(String(url)).toContain('/contact')
    const cuerpo = JSON.parse(init.body as string)
    expect(cuerpo).toMatchObject({ nombre: 'Ana', email: 'ana@example.es', telefono: '', comentarioAdicional: '' })
    expect(typeof cuerpo.tiempoRelleno).toBe('number')
    expect(cuerpo.tiempoRelleno).toBeGreaterThanOrEqual(0)
  })

  it('el campo trampa no se ve, no se alcanza con el tabulador y los lectores de pantalla lo ignoran', async () => {
    responderBien()
    const { container } = renderWithProviders(<ContactoPage />)
    await screen.findByLabelText('Nombre')
    const trampa = container.querySelector<HTMLInputElement>('#contacto-comentario-adicional')!
    expect(trampa).toBeInTheDocument()
    expect(trampa.tabIndex).toBe(-1)
    // Que no lo rellenen por la persona ni el navegador ni los gestores de contraseñas.
    expect(trampa).toHaveAttribute('autocomplete', 'off')
    expect(trampa).toHaveAttribute('data-lpignore', 'true')
    expect(trampa).toHaveAttribute('data-1p-ignore', 'true')
    expect(trampa.name).not.toMatch(/web|url|site|name|nombre|mail|tel|address|direcc/i)
    expect(trampa.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('textbox', { name: /deja este campo vacío/i })).not.toBeInTheDocument()
  })

  it('avisa en el formulario de un email que el servidor rechazaría', async () => {
    // «ana@example» lo da por bueno el propio navegador (type="email"), así que
    // el aviso tiene que salir de nuestro esquema.
    const usuario = userEvent.setup()
    const simulado = responderBien()
    renderWithProviders(<ContactoPage />)

    await rellenar(usuario, { email: 'ana@example' })
    await usuario.click(screen.getByRole('button', { name: /enviar mensaje/i }))

    expect(await screen.findByText('Introduce un email válido')).toBeInTheDocument()
    await waitFor(() => expect(simulado).not.toHaveBeenCalled())
  })

  it('avisa si el teléfono no tiene pinta de teléfono', async () => {
    const usuario = userEvent.setup()
    const simulado = responderBien()
    renderWithProviders(<ContactoPage />)

    await rellenar(usuario, { telefono: '123' })
    await usuario.click(screen.getByRole('button', { name: /enviar mensaje/i }))

    expect(await screen.findByText(/introduce un teléfono válido/i)).toBeInTheDocument()
    expect(simulado).not.toHaveBeenCalled()
  })
})

describe('contactSchema', () => {
  const valido = { nombre: 'Ana', email: 'ana@example.es', telefono: '', asunto: 'Besapiés', mensaje: 'Quería preguntar por el horario.' }

  it('rechaza los emails que acabarían en el «Responder a» como otra dirección', () => {
    for (const email of ['"x"<ana@example.es>', 'ana,otro@example.es', 'ana@example.es;otro@example.es', 'ana maria@example.es']) {
      expect(contactSchema.safeParse({ ...valido, email }).success, email).toBe(false)
    }
    expect(contactSchema.safeParse({ ...valido, email: "o'brien@example.ie" }).success).toBe(true)
  })

  it('los espacios no cuentan para los diez caracteres del mensaje', () => {
    expect(contactSchema.safeParse({ ...valido, mensaje: '   hola      ' }).success).toBe(false)
    expect(contactSchema.safeParse({ ...valido, mensaje: '  Diez letras  ' }).success).toBe(true)
  })
})

describe('telefonoValido', () => {
  it('admite vacío y formatos internacionales razonables; rechaza lo demás', () => {
    for (const valido of ['', '600123456', '+34 600 12 34 56', '+44 (0) 20 7946 0958', '951-234-567']) expect(telefonoValido(valido)).toBe(true)
    for (const invalido of ['123', 'no tengo', '++34600123456', '+34 600 123 456 789 012 345']) expect(telefonoValido(invalido)).toBe(false)
  })
})
