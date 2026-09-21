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

export type AreaSesion = 'cms' | 'hermanos'

/**
 * `cargando` es el estado inicial: todavía no sabemos qué sesiones hay porque
 * la respuesta de /api/auth/me no ha llegado. Los guardas de ruta deben esperar
 * en lugar de mandar al login, o expulsarían a quien sí tiene sesión.
 */
export type AuthStatus = 'cargando' | 'listo'

/** Clave que usaba zustand/persist cuando el token vivía en el navegador */
export const CLAVE_PERSISTENCIA_ANTIGUA = 'desamparados-auth'

interface AuthState {
  status: AuthStatus
  /**
   * Una sesión por área, independientes. La misma persona puede estar dentro
   * del CMS como Tesorero y dentro del portal como hermano: antes compartían
   * cookie y la segunda tiraba a la primera.
   */
  cms: AuthUser | null
  hermano: AuthUser | null
  entrarSesion: (area: AreaSesion, user: AuthUser) => void
  salirSesion: (area?: AreaSesion) => void
}

// Sin persist: las sesiones viven en cookies httpOnly y el navegador no guarda
// aquí ni el token ni los datos personales.
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'cargando',
  cms: null,
  hermano: null,
  entrarSesion: (area, user) =>
    set(area === 'cms' ? { status: 'listo', cms: user } : { status: 'listo', hermano: user }),
  salirSesion: (area) =>
    set(
      area === 'cms' ? { status: 'listo', cms: null }
      : area === 'hermanos' ? { status: 'listo', hermano: null }
      : { status: 'listo', cms: null, hermano: null },
    ),
}))

/** Roles con acceso al CMS/Secretaría (el resto son hermanos rasos: USER) */
export const isStaffRole = (role?: string | null) => !!role && role !== 'USER'
