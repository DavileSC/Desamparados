import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import MarcoAreaHermano from '../MarcoAreaHermano'
import { entradasDelArea } from '../areaHermanoNavegacion'
import { useAuthStore } from '../../features/altas/auth/store'

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

  it('todas las entradas llevan su módulo', () => {
    for (const e of entradasDelArea) expect(e.modulo, e.label).toBeDefined()
  })
})
