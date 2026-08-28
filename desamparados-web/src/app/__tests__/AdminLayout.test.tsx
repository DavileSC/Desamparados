import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import AdminLayout, { itemsMenu } from '../AdminLayout'
import { useAuthStore } from '../../features/members/auth/store'
import { rolesPorRutaCms } from '../../routes'

function entrarComo(role: string) {
  useAuthStore.setState({
    status: 'autenticado',
    user: { id: 1, email: 'prueba@ejemplo.es', role, perfiles: [] },
  })
}

describe('AdminLayout', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'cargando', user: null })
  })

  it('el Hermano Mayor ve tesorería y contabilidad', () => {
    entrarComo('HERMANO_MAYOR')
    renderWithProviders(<AdminLayout />)
    expect(screen.getByRole('link', { name: 'Tesorería' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contabilidad' })).toBeInTheDocument()
  })

  it('el community manager no ve tesorería', () => {
    entrarComo('REDES')
    renderWithProviders(<AdminLayout />)
    expect(screen.queryByRole('link', { name: 'Tesorería' })).not.toBeInTheDocument()
  })

  it('todo el staff tiene el panel como primera entrada', () => {
    entrarComo('REDES')
    renderWithProviders(<AdminLayout />)
    const enlaces = screen.getAllByRole('link')
    expect(enlaces[1]).toHaveAccessibleName('Panel') // [0] es el logotipo
  })

  it('dice quién ha entrado', () => {
    entrarComo('SECRETARIA')
    renderWithProviders(<AdminLayout />)
    expect(screen.getByText('Secretaría')).toBeInTheDocument()
  })
})

/**
 * Nadie tocaba RequireRole hasta ahora, y por eso el menú y las guardas de
 * ruta se desincronizaron sin que ningún test lo notara: el Hermano Mayor
 * veía Tesorería, Contabilidad y Auditoría en el menú, pero la guarda de
 * `routes/index.tsx` seguía sin él y lo expulsaba a /area-hermano en cuanto
 * pulsaba. Este test compara las dos fuentes de verdad entrada por entrada
 * para que no puedan volver a divergir en silencio.
 */
describe('el menú del CMS y las guardas de ruta no divergen', () => {
  it('cada entrada de itemsMenu ve exactamente los roles que deja pasar su guarda de ruta', () => {
    expect(itemsMenu.length).toBeGreaterThan(0)

    for (const item of itemsMenu) {
      const clave = (item.href === '/cms' ? 'panel' : item.href.slice('/cms/'.length)) as keyof typeof rolesPorRutaCms
      const rolesGuarda = rolesPorRutaCms[clave]
      expect(rolesGuarda, `${item.href} no tiene guarda declarada en rolesPorRutaCms`).toBeDefined()
      expect([...item.roles].sort()).toEqual([...rolesGuarda].sort())
    }
  })
})
