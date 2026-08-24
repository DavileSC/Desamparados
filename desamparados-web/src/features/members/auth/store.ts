import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Ficha de hermano gestionada por la cuenta (un usuario puede gestionar a su familia) */
export interface AuthPerfil {
  id: number
  nombre: string
  esTitular: boolean
  puesto: string | null
}

/** Usuario tal y como lo devuelve POST /api/auth/login */
export interface AuthUser {
  id: number
  email: string
  role: string
  perfiles: AuthPerfil[]
}

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  user: AuthUser | null
  login: (payload: { token: string; user: AuthUser }) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      token: null,
      user: null,
      login: ({ token, user }) => set({ isAuthenticated: true, token, user }),
      logout: () => set({ isAuthenticated: false, token: null, user: null }),
    }),
    {
      name: 'desamparados-auth',
      version: 2, // v1 guardaba solo un flag sin token: se descarta
      migrate: () => ({ isAuthenticated: false, token: null, user: null }),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        user: state.user,
      }),
    }
  )
)

/** Roles con acceso al CMS/Secretaría (el resto son hermanos rasos: USER) */
export const isStaffRole = (role?: string | null) => !!role && role !== 'USER'
