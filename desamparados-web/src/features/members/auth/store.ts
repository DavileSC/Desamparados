import { create } from 'zustand'

/** Ficha de hermano gestionada por la cuenta (un usuario puede gestionar a su familia) */
export interface AuthPerfil {
  id: number
  nombre: string
  esTitular: boolean
  puesto: string | null
}

/** Usuario tal y como lo devuelven POST /api/auth/login y GET /api/auth/me */
export interface AuthUser {
  id: number
  email: string
  role: string
  perfiles: AuthPerfil[]
  /** Lo trae GET /api/auth/me: la pantalla "Mi seguridad" lo necesita. */
  twoFactorEnabled?: boolean
  /** De qué login nació la sesión: el CMS solo acepta tokens creados allí. */
  origen?: 'cms' | 'hermanos'
}

/**
 * `cargando` es el estado inicial: todavía no sabemos si hay sesión porque la
 * respuesta de /api/auth/me no ha llegado. Los guardas de ruta deben esperar en
 * lugar de mandar al login, o expulsarían a quien sí tiene sesión.
 */
export type AuthStatus = 'cargando' | 'autenticado' | 'invitado'

/** Clave que usaba zustand/persist cuando el token vivía en el navegador */
export const CLAVE_PERSISTENCIA_ANTIGUA = 'desamparados-auth'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  entrarSesion: (user: AuthUser) => void
  salirSesion: () => void
}

// Sin persist: la sesión vive en una cookie httpOnly y el navegador no guarda
// aquí ni el token ni los datos personales.
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'cargando',
  user: null,
  entrarSesion: (user) => set({ status: 'autenticado', user }),
  salirSesion: () => set({ status: 'invitado', user: null }),
}))

/** Roles con acceso al CMS/Secretaría (el resto son hermanos rasos: USER) */
export const isStaffRole = (role?: string | null) => !!role && role !== 'USER'
