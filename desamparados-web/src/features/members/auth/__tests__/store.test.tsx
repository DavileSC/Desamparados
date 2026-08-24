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
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null })
  })

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('logs in a user storing the token', () => {
    useAuthStore.getState().login({ token: 'jwt-token', user })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().token).toBe('jwt-token')
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('logs out a user clearing the token', () => {
    useAuthStore.getState().login({ token: 'jwt-token', user })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('detects staff roles', () => {
    expect(isStaffRole('USER')).toBe(false)
    expect(isStaffRole('SECRETARIA')).toBe(true)
    expect(isStaffRole(null)).toBe(false)
  })
})
