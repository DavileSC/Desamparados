import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import { useAuthStore } from '../../altas/auth/store'
import DatosCorporacionPage from '../DatosCorporacionPage'
import type { EstadoDeLaMarca } from '../../../lib/api/corporacion'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const imagen = (fichero: string, propia: boolean) => ({ url: `/marca/${fichero}?v=1`, propia, ancho: 245, alto: 300, tipo: 'image/png' })

const ESTADO: EstadoDeLaMarca = {
  identidad: {
    nombre: 'Hermandad de la Prueba', nombreCorto: 'La Prueba', tipo: 'Hermandad', tipoCorto: 'Hermandad', articulo: 'la',
    titulares: ['Nuestra Señora de la Prueba'], localidad: 'Villaprueba', descripcion: 'Una hermandad de prueba.',
    denominacion: null, domicilio: 'Plaza Mayor, 1', normas: null,
  },
  colores: { colorPrincipal: null, colorAcento: null },
  dominio: 'www.prueba.example',
  imagenes: {
    escudoSobreOscuro: imagen('escudo-sobre-oscuro.png', true),
    escudoSobreClaro: imagen('escudo-sobre-claro.png', false),
    escudoDestacado: null,
    compartir: null,
    correoCabecera: null,
  },
  iconos: { favicon32: '/marca/favicon-32.png?v=1', appleTouchIcon: '/marca/apple-touch-icon.png?v=1', icono192: '/marca/icono-192.png?v=1', icono512: '/marca/icono-512.png?v=1' },
  avisos: [],
}

/** El servidor: la marca, y al guardar lo que le mandan; al subir o quitar, el estado que se le diga. */
function servidor(alSubir: (url: string) => Response = () => json(ESTADO)) {
  const fetch = vi.fn(async (url: string, opciones?: RequestInit) => {
    if (opciones?.method === 'PUT' && url.endsWith('/identidad')) {
      const enviado = JSON.parse(String(opciones.body)) as Pick<EstadoDeLaMarca, 'identidad' | 'colores'>
      return json({ ...ESTADO, ...enviado })
    }
    if (opciones?.method === 'PUT' || opciones?.method === 'DELETE') return alSubir(url)
    return json(url.includes('/marca') ? ESTADO : { secretaria: {}, sede: {}, redes: {}, privacidad: {} })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const como = (role: 'ADMIN' | 'SECRETARIA') =>
  useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'a@ejemplo.es', role, perfiles: [], origen: 'cms' }, hermano: null })

beforeEach(() => como('ADMIN'))
afterEach(() => { vi.unstubAllGlobals() })

describe('Identidad y marca', () => {
  it('Secretaría no ve las pestañas: la identidad es de Administración', async () => {
    como('SECRETARIA')
    servidor()
    renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true, ruta: '/cms/corporacion?ver=marca' })
    expect(await screen.findByRole('textbox', { name: 'Horario' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('carga la identidad y guarda los vacíos como null y los colores en minúscula', async () => {
    const fetch = servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true, ruta: '/cms/corporacion?ver=marca' })

    const nombre = await screen.findByRole('textbox', { name: 'Nombre completo' }, { timeout: 5000 })
    expect(nombre).toHaveValue('Hermandad de la Prueba')
    expect(screen.getByRole('tab', { name: 'Identidad y marca' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()

    await usuario.clear(nombre)
    await usuario.type(nombre, 'Hermandad de la Nueva Prueba')
    await usuario.clear(screen.getByRole('textbox', { name: 'Domicilio social' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Principal' }), '#1F3A6B')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(fetch.mock.calls.some(([u, o]) => String(u).endsWith('/identidad') && o?.method === 'PUT')).toBe(true))
    const [, opciones] = fetch.mock.calls.find(([u, o]) => String(u).endsWith('/identidad') && o?.method === 'PUT')!
    const enviado = JSON.parse(String(opciones!.body))
    expect(enviado.identidad).toEqual({ ...ESTADO.identidad, nombre: 'Hermandad de la Nueva Prueba', domicilio: null })
    expect(enviado.colores).toEqual({ colorPrincipal: '#1f3a6b', colorAcento: null })
    expect(await screen.findByText(/Guardado\. Quien abra la web ya lo ve nuevo/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    // Lo guardado pasa a ser lo de partida del formulario: nada queda sin guardar.
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('con «Añadir titular» guarda la lista en orden, y un titular vacío no se guarda', async () => {
    const fetch = servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true, ruta: '/cms/corporacion?ver=marca' })
    expect(await screen.findByRole('textbox', { name: 'Titular' }, { timeout: 5000 })).toHaveValue('Nuestra Señora de la Prueba')
    expect(screen.queryByRole('button', { name: /Quitar el titular/ })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Añadir titular' }))
    expect(screen.getByRole('textbox', { name: 'Titular 1' })).toHaveValue('Nuestra Señora de la Prueba')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await usuario.type(screen.getByRole('textbox', { name: 'Titular 2' }), 'Santísimo Cristo de la Prueba')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(fetch.mock.calls.some(([u, o]) => String(u).endsWith('/identidad') && o?.method === 'PUT')).toBe(true))
    const [, opciones] = fetch.mock.calls.find(([u, o]) => String(u).endsWith('/identidad') && o?.method === 'PUT')!
    expect(JSON.parse(String(opciones!.body)).identidad.titulares).toEqual(['Nuestra Señora de la Prueba', 'Santísimo Cristo de la Prueba'])
    await usuario.click(await screen.findByRole('button', { name: 'Quitar el titular 2' }))
    expect(screen.getByRole('textbox', { name: 'Titular' })).toHaveValue('Nuestra Señora de la Prueba')
  })

  it('no deja guardar un nombre vacío, un color mal escrito ni las normas a medias', async () => {
    servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true, ruta: '/cms/corporacion?ver=marca' })
    await usuario.clear(await screen.findByRole('textbox', { name: 'Nombre corto' }, { timeout: 5000 }))
    await usuario.type(screen.getByRole('textbox', { name: 'Acento' }), 'oro')
    await usuario.type(screen.getByRole('textbox', { name: 'Se rige por' }), 'los estatutos')

    expect(screen.getByText('No puede quedar vacío.')).toBeInTheDocument()
    expect(screen.getByText('Un color #rrggbb, como #1f3a6b.')).toBeInTheDocument()
    expect(screen.getByText('Falta el enlace (o vacía las dos).')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('un color sin contraste se avisa con la cifra antes de guardar', async () => {
    servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true, ruta: '/cms/corporacion?ver=marca' })
    expect(await screen.findByText('Los dos cumplen el contraste en todos los fondos.', {}, { timeout: 5000 })).toBeInTheDocument()
    await usuario.type(screen.getByRole('textbox', { name: 'Principal' }), '#f5f5f5')
    expect(await screen.findByRole('alert')).toHaveTextContent(/contraste|4,5/)
  })

  it('sube una imagen al elegirla y dice por qué no sirve si el servidor la rechaza', async () => {
    const fetch = servidor(() => json({ error: 'No se puede leer como imagen: tiene que ser un PNG, un JPEG o un WebP.' }, 400))
    const usuario = userEvent.setup()
    const { container } = renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true, ruta: '/cms/corporacion?ver=marca' })
    await screen.findByRole('textbox', { name: 'Nombre completo' }, { timeout: 5000 })

    const tarjeta = screen.getByText('Imagen para compartir').closest('div')!.parentElement!
    expect(within(tarjeta).getByText('Sin imagen')).toBeInTheDocument()
    const campos = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
    await usuario.upload(campos[3], new File(['no es una foto'], 'foto.png', { type: 'image/png' }))

    await waitFor(() => expect(fetch.mock.calls.some(([u, o]) => String(u).endsWith('/marca/compartir') && o?.method === 'PUT')).toBe(true))
    expect(await screen.findByText(/tiene que ser un PNG, un JPEG o un WebP/, {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('quitar una imagen propia pregunta antes', async () => {
    const fetch = servidor()
    const usuario = userEvent.setup()
    renderWithProviders(<DatosCorporacionPage />, { routerDeDatos: true, ruta: '/cms/corporacion?ver=marca' })
    await screen.findByRole('textbox', { name: 'Nombre completo' }, { timeout: 5000 })
    // Solo la del escudo sobre oscuro es propia: las de partida no se quitan.
    expect(screen.getAllByRole('button', { name: 'Quitar' })).toHaveLength(1)
    await usuario.click(screen.getByRole('button', { name: 'Quitar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('escudo genérico')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(fetch.mock.calls.some(([u, o]) => String(u).endsWith('/marca/escudoSobreOscuro') && o?.method === 'DELETE')).toBe(true))
  })
})
