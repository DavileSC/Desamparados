import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import HazteHermanoPage from '../HazteHermanoPage'

// `delay: null` quita la espera que userEvent mete entre pulsación y
// pulsación. Son diez campos tecleados letra a letra: con la espera, cada
// test rondaba los 3 s estando solo y se pasaba del tope de 5 s en cuanto la
// batería completa competía por la CPU. Aquí no se comprueba nada del ritmo
// de escritura, así que la espera solo costaba tiempo y falsos rojos.
const usuario = () => userEvent.setup({ delay: null })
type Usuario = ReturnType<typeof usuario>

const DATOS: Record<string, string> = {
  Nombre: 'Juan', Apellidos: 'Pérez Ruiz', 'DNI/NIE': '12345678Z', 'Fecha de nacimiento': '1990-04-12',
  Email: 'juan@ejemplo.es', Teléfono: '600123456',
  Dirección: 'Calle Real 14', Ciudad: 'Málaga', 'Código postal': '29013',
  Contraseña: 'Prueba-2026-Segura',
}

// El formulario va por pasos: los tres están en el DOM (así la tarjeta mide
// siempre lo mismo) pero solo se ve, y se puede usar, el paso actual.
const PASO_1 = ['Nombre', 'Apellidos', 'DNI/NIE', 'Fecha de nacimiento']
const PASO_2 = ['Email', 'Teléfono', 'Dirección', 'Ciudad', 'Código postal']

async function rellenar(u: Usuario, etiquetas: string[], datos: Partial<Record<string, string>> = {}) {
  for (const etiqueta of etiquetas) {
    const campo = screen.getByLabelText(etiqueta)
    await u.clear(campo)
    await u.type(campo, datos[etiqueta] ?? DATOS[etiqueta])
  }
}

const continuar = (u: Usuario) => u.click(screen.getByRole('button', { name: 'Continuar' }))

/**
 * El paso de un campo, por su fieldset. Los pasos que no tocan van `inert`
 * (ni se usan ni los lee un lector). No se comprueba la visibilidad porque el
 * envoltorio animado arranca con opacidad 0 y en jsdom nunca entra en pantalla.
 */
const pasoDe = (etiqueta: string) => screen.getByLabelText(etiqueta).closest('fieldset')!

/** Recorre los tres pasos y deja el formulario listo para enviar. */
async function rellenarTodo(datos: Partial<Record<string, string>> = {}) {
  const u = usuario()
  await rellenar(u, PASO_1, datos)
  await continuar(u)
  await rellenar(u, PASO_2, datos)
  await continuar(u)
  await rellenar(u, ['Contraseña'], datos)
  await u.click(screen.getByLabelText('Acepto la política de privacidad'))
  return u
}

const enviar = (u: Usuario) => u.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

const respuesta = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

describe('HazteHermanoPage', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('no pasa del primer paso con un DNI de letra equivocada', async () => {
    // El servidor lo rechazaba con un «Error de validación» sin más: el
    // navegador daba por bueno cualquier letra.
    const fetchFalso = vi.fn()
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await rellenar(u, PASO_1, { 'DNI/NIE': '12345678A' })
    await continuar(u)

    expect(await screen.findByText(/la letra no corresponde/i)).toBeInTheDocument()
    expect(pasoDe('Email')).toHaveAttribute('inert')
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument()
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('no pasa del segundo paso con un teléfono que no son nueve dígitos', async () => {
    const fetchFalso = vi.fn()
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await rellenar(u, PASO_1)
    await continuar(u)
    await rellenar(u, PASO_2, { Teléfono: '95212345' })
    await continuar(u)

    expect(await screen.findByText(/nueve d[ií]gitos/i)).toBeInTheDocument()
    expect(pasoDe('Contraseña')).toHaveAttribute('inert')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('conserva lo escrito al volver atrás', async () => {
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await rellenar(u, PASO_1)
    await continuar(u)
    expect(pasoDe('Email')).not.toHaveAttribute('inert')
    await u.click(screen.getByRole('button', { name: 'Atrás' }))

    expect(pasoDe('Nombre')).not.toHaveAttribute('inert')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Juan')
    expect(screen.getByLabelText('DNI/NIE')).toHaveValue('12345678Z')
  })

  it('manda el DNI y el teléfono normalizados', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta({ user: { id: 1, email: 'juan@ejemplo.es' }, message: 'ok' }, 201),
    )
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = await rellenarTodo({ 'DNI/NIE': '12345678-z', Teléfono: '+34 600 12 34 56' })
    await enviar(u)

    expect(fetchFalso).toHaveBeenCalled()
    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body)
    expect(cuerpo.usuario.dni).toBe('12345678Z')
    expect(cuerpo.usuario.telefono).toBe('600123456')
  })

  it('vuelve al paso del campo que rechaza el servidor y lo enfoca', async () => {
    // El servidor manda { message: 'Error de validación', errors: [{field, message}] }
    // y la página solo enseñaba el message: un aviso que no dice qué corregir.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({
      status: 'error',
      message: 'Error de validación',
      errors: [{ field: 'usuario.dni', message: 'ese DNI ya está registrado' }],
    }, 400)))
    renderWithProviders(<HazteHermanoPage />)
    const u = await rellenarTodo()
    await enviar(u)

    expect(await screen.findByText('ese DNI ya está registrado')).toBeInTheDocument()
    expect(pasoDe('DNI/NIE')).not.toHaveAttribute('inert')
    expect(screen.getByLabelText('DNI/NIE')).toHaveFocus()
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument()
  })

  it('sustituye el formulario por la confirmación con el email usado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ user: { id: 1, email: 'juan@ejemplo.es' }, message: 'ok' }, 201),
    ))
    renderWithProviders(<HazteHermanoPage />)
    const u = await rellenarTodo()
    await enviar(u)

    // El título recibe el foco: quien va con teclado o lector de pantalla se
    // entera de que la página ha cambiado y no se queda sobre un botón que ya no está.
    const titulo = await screen.findByRole('heading', { name: /Gracias, Juan/ })
    expect(titulo).toHaveFocus()
    expect(screen.getByText('juan@ejemplo.es')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument()
  })
})
