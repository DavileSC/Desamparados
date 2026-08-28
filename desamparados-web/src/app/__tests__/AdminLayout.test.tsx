import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import AdminLayout from '../AdminLayout'
import { useAuthStore } from '../../features/members/auth/store'

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
