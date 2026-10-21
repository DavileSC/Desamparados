import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import { useAuthStore } from '../../altas/auth/store'
import AsistentePage from '../asistente/AsistentePage'
import type { EstadoDeLaMarca, EstadoDelAsistente } from '../../../lib/api/corporacion'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const imagen = (fichero: string, propia: boolean) => ({ url: `/marca/${fichero}?v=1`, propia, ancho: 245, alto: 300, tipo: 'image/png' })

const MARCA: EstadoDeLaMarca = {
  identidad: {
    nombre: 'Hermandad de la Prueba', nombreCorto: 'La Prueba', tipo: 'Hermandad', tipoCorto: 'Hermandad', articulo: 'la',
    titulares: ['Nuestra Señora de la Prueba'], localidad: 'Villaprueba', descripcion: 'Una hermandad de prueba.',
    denominacion: null, domicilio: null, normas: null,
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

/** El servidor: recuerda el estado del asistente que se le apunta y devuelve lo que le mandan al guardar. */
function servidor(inicial: EstadoDelAsistente) {
  let asistente = inicial
  const fetch = vi.fn(async (url: string, opciones?: RequestInit) => {
    const cuerpo = opciones?.body ? JSON.parse(String(opciones.body)) : null
    if (url.endsWith('/asistente')) {
      if (opciones?.method === 'PUT') {
        asistente = { paso: cuerpo.paso, saltados: cuerpo.saltados, terminado: asistente.terminado ?? (cuerpo.terminar ? '2026-10-21T10:00:00Z' : null) }
      }
      return json(asistente)
    }
    if (url.endsWith('/identidad')) return json({ ...MARCA, ...cuerpo })
    if (url.includes('/marca')) return json(MARCA)
    if (url.endsWith('/cms/modulos')) return json([])
    return json(cuerpo ?? { secretaria: {}, sede: {}, redes: {}, privacidad: {} })
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, apuntado: () => asistente }
}

const RUTA = { routerDeDatos: true, ruta: '/cms/bienvenida' } as const

beforeEach(() => useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'a@ejemplo.es', role: 'ADMIN', perfiles: [], origen: 'cms' }, hermano: null }))
afterEach(() => { vi.unstubAllGlobals() })

describe('el asistente de primer arranque', () => {
  it('empieza por el nombre, que no se puede saltar, y al guardarlo pasa al escudo', async () => {
    const { fetch, apuntado } = servidor({ paso: 0, saltados: [], terminado: null })
    const usuario = userEvent.setup()
    renderWithProviders(<AsistentePage />, RUTA)

    const nombre = await screen.findByRole('textbox', { name: 'Nombre completo' }, { timeout: 5000 })
    expect(screen.getByText('Paso 1 de 7')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Saltar este paso' })).not.toBeInTheDocument()

    await usuario.clear(nombre)
    await usuario.type(nombre, 'Hermandad de la Nueva Prueba')
    // La vista previa enseña lo que se escribe, antes de guardar.
    expect(screen.getAllByText('Hermandad de la Nueva Prueba').length).toBeGreaterThan(0)
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('heading', { name: 'El escudo' }, { timeout: 5000 })).toBeInTheDocument()
    const guardado = fetch.mock.calls.find(([u, o]) => String(u).endsWith('/identidad') && o?.method === 'PUT')
    expect(JSON.parse(String(guardado![1]!.body)).identidad.nombre).toBe('Hermandad de la Nueva Prueba')
    await waitFor(() => expect(apuntado().paso).toBe(1))
  })

  it('se retoma donde se dejó, y lo saltado sale en el resumen con «Ponerlo ahora»', async () => {
    const { apuntado } = servidor({ paso: 4, saltados: ['colores'], terminado: null })
    const usuario = userEvent.setup()
    renderWithProviders(<AsistentePage />, RUTA)

    expect(await screen.findByRole('heading', { name: 'Los datos legales' }, { timeout: 5000 })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Saltar este paso' }))
    expect(await screen.findByRole('heading', { name: 'Las secciones' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('heading', { name: 'La web ya es vuestra' })).toBeInTheDocument()
    await waitFor(() => expect(apuntado().terminado).not.toBeNull())
    expect(apuntado().saltados).toEqual(['colores', 'legales'])
    expect(screen.getByRole('button', { name: 'Ponerlo ahora: Los colores' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ponerlo ahora: Los datos legales' })).toBeInTheDocument()

    // Volver a un paso saltado y hacerlo lo quita de los saltados.
    await usuario.click(screen.getByRole('button', { name: 'Ponerlo ahora: Los colores' }))
    expect(await screen.findByRole('heading', { name: 'Los colores' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(apuntado().saltados).toEqual(['legales']))
  })

  it('terminado, se repasa desde el principio y el botón de arriba es «Salir»', async () => {
    servidor({ paso: 6, saltados: [], terminado: '2026-10-20T10:00:00Z' })
    renderWithProviders(<AsistentePage />, RUTA)
    expect(await screen.findByRole('heading', { name: 'El nombre' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument()
  })
})
