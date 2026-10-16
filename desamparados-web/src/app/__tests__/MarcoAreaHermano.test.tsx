import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../test/test-utils'
import MarcoAreaHermano from '../MarcoAreaHermano'
import { entradasDelArea } from '../areaHermanoNavegacion'
import { useAuthStore } from '../../features/altas/auth/store'
import { FICHAS_POR_FAMILIA } from '../../lib/api/perfil'

/** Dos fichas: la del titular y la de un sobrino, con lo que el selector del menú enseña. */
function conFamilia() {
  const ficha = (id: number, nombre: string, esTitular: boolean, numeroHermano: number | null, fechaNacimiento: string) =>
    ({ id, nombre, apellidos: 'Pérez Ruiz', primerApellido: 'Pérez', segundoApellido: 'Ruiz', esTitular, numeroHermano, fechaNacimiento, activo: true })
  const cuerpo = { data: [ficha(2, 'Bruno', false, null, '2014-06-01T00:00:00.000Z'), ficha(1, 'Ana', true, 42, '1980-05-10T00:00:00.000Z')], meta: { total: 2, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 1 } }
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
}

function Direccion() {
  const { pathname, search } = useLocation()
  return <span data-testid="direccion">{pathname}{search}</span>
}

describe('el menú del área de hermanos', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'listo', cms: null, hermano: { id: 1, email: 'h@ejemplo.es', role: 'USER', perfiles: [], origen: 'hermanos' } })
  })

  it('sin Procesión, la entrada «Procesión» no está; las demás sí', () => {
    renderWithProviders(<MarcoAreaHermano />, { ruta: '/area-hermano/perfil', modulos: ['area-hermanos'] })
    expect(screen.queryAllByRole('link', { name: 'Procesión' })).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Recibos' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Mi perfil' }).length).toBeGreaterThan(0)
  })

  it('lleva «Saltar al contenido» y el botón del menú dice qué hace', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MarcoAreaHermano />, { ruta: '/area-hermano/perfil', modulos: ['area-hermanos'] })
    await user.click(screen.getByRole('link', { name: 'Saltar al contenido' }))
    expect(screen.getByRole('main')).toHaveFocus()
    const boton = screen.getByRole('button', { name: 'Abrir el menú' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('el menú dice qué ficha se está viendo, con nombre, primer apellido y número', async () => {
    conFamilia()
    renderWithProviders(<MarcoAreaHermano />, { ruta: '/area-hermano/perfil?ficha=2&apartado=contacto', modulos: ['area-hermanos'] })
    const [selector] = await screen.findAllByRole('combobox', { name: /ficha que estás viendo/i })
    expect(selector).toHaveTextContent('Bruno Pérez · sin número')
    // En la barra del móvil, en lugar del título.
    expect(screen.getByRole('button', { name: /Ficha que estás viendo: Bruno Pérez · sin número/ })).toBeInTheDocument()
  })

  it('cambiar de ficha lleva a Mi perfil con ella, y en Mi perfil no cambia de pestaña', async () => {
    const user = userEvent.setup()
    conFamilia()
    renderWithProviders(<><MarcoAreaHermano /><Direccion /></>, { ruta: '/area-hermano/recibos', modulos: ['area-hermanos'] })
    const [selector] = await screen.findAllByRole('combobox', { name: /ficha que estás viendo/i })
    // Fuera de Mi perfil, la del titular: es la que abre Mi perfil sin ?ficha=.
    expect(selector).toHaveTextContent('Ana Pérez · n.º 42')

    await user.click(selector!)
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Bruno Pérez · sin número' }))
    expect(screen.getByTestId('direccion')).toHaveTextContent('/area-hermano/perfil?ficha=2')
  })

  it('todas las entradas llevan su módulo', () => {
    for (const e of entradasDelArea) expect(e.modulo, e.label).toBeDefined()
  })
})
