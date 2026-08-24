import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../store'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null })
  })

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('logs in a user', () => {
    const user = { id: '1', name: 'Test', email: 'test@test.com' }
    useAuthStore.getState().login(user)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('logs out a user', () => {
    const user = { id: '1', name: 'Test', email: 'test@test.com' }
    useAuthStore.getState().login(user)
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })
})
