import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, isStaffRole, type AuthUser } from '../store'

const user: AuthUser = {
  id: 1,
  email: 'test@test.com',
  role: 'USER',
  perfiles: [{ id: 10, nombre: 'Test', esTitular: true, puesto: null }],
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'cargando', user: null })
  })

  it('arranca en cargando, sin dar por hecho que hay sesion', () => {
    expect(useAuthStore.getState().status).toBe('cargando')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('entrarSesion guarda al usuario sin ningun token', () => {
    useAuthStore.getState().entrarSesion(user)
    expect(useAuthStore.getState().status).toBe('autenticado')
    expect(useAuthStore.getState().user).toEqual(user)
    expect(useAuthStore.getState()).not.toHaveProperty('token')
  })

  it('salirSesion deja el estado como invitado', () => {
    useAuthStore.getState().entrarSesion(user)
    useAuthStore.getState().salirSesion()
    expect(useAuthStore.getState().status).toBe('invitado')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('no persiste nada en localStorage', () => {
    useAuthStore.getState().entrarSesion(user)
    expect(localStorage.getItem('desamparados-auth')).toBeNull()
  })

  it('detects staff roles', () => {
    expect(isStaffRole('USER')).toBe(false)
    expect(isStaffRole('SECRETARIA')).toBe(true)
    expect(isStaffRole(null)).toBe(false)
  })
})
