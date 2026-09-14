import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../store'

const HERMANO = { id: 1, email: 'juan@ejemplo.es', role: 'USER', perfiles: [], origen: 'hermanos' as const }
const TESORERO = { id: 1, email: 'juan@ejemplo.es', role: 'TESORERIA', perfiles: [], origen: 'cms' as const }

describe('el estado de sesión', () => {
  beforeEach(() => { useAuthStore.setState({ status: 'cargando', cms: null, hermano: null }) })

  it('guarda las dos sesiones a la vez', () => {
    // El mismo correo entra al CMS como Tesorero y al portal como hermano.
    useAuthStore.getState().entrarSesion('cms', TESORERO)
    useAuthStore.getState().entrarSesion('hermanos', HERMANO)
    expect(useAuthStore.getState().cms?.role).toBe('TESORERIA')
    expect(useAuthStore.getState().hermano?.role).toBe('USER')
  })

  it('salir de un área no toca la otra', () => {
    useAuthStore.getState().entrarSesion('cms', TESORERO)
    useAuthStore.getState().entrarSesion('hermanos', HERMANO)
    useAuthStore.getState().salirSesion('hermanos')
    expect(useAuthStore.getState().hermano).toBeNull()
    expect(useAuthStore.getState().cms?.role).toBe('TESORERIA')
  })

  it('salir sin área vacía las dos', () => {
    useAuthStore.getState().entrarSesion('cms', TESORERO)
    useAuthStore.getState().entrarSesion('hermanos', HERMANO)
    useAuthStore.getState().salirSesion()
    expect(useAuthStore.getState().cms).toBeNull()
    expect(useAuthStore.getState().hermano).toBeNull()
  })
})
