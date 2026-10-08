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
  /**
   * La sesión del CMS ha caducado mientras se trabajaba en él. `cms` conserva
   * al usuario de antes a propósito: si se vaciara, `ExigeRol` cambiaría la
   * pantalla entera por el acceso y se perdería lo que se estaba escribiendo.
   * En su lugar, el marco del CMS abre una ventana para volver a entrar. El
   * servidor sigue rechazando cada petición mientras tanto: esto es solo lo
   * que se pinta, no un permiso.
   */
  cmsCaducada: boolean
  entrarSesion: (area: AreaSesion, user: AuthUser) => void
  salirSesion: (area?: AreaSesion) => void
  /**
   * Lo que responde /auth/me, de una vez. En dos pasos (salir y volver a
   * entrar) quien escucha los cambios de usuario veía un instante sin nadie y
   * vaciaba la caché de una sesión que seguía siendo la misma.
   */
  ponerSesiones: (sesiones: { cms: AuthUser | null; hermano: AuthUser | null }) => void
}

// Sin persist: las sesiones viven en cookies httpOnly y el navegador no guarda
// aquí ni el token ni los datos personales.
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'cargando',
  cms: null,
  hermano: null,
  cmsCaducada: false,
  entrarSesion: (area, user) =>
    set(area === 'cms' ? { status: 'listo', cms: user, cmsCaducada: false } : { status: 'listo', hermano: user }),
  salirSesion: (area) =>
    set(
      area === 'cms' ? { status: 'listo', cms: null, cmsCaducada: false }
      : area === 'hermanos' ? { status: 'listo', hermano: null }
      : { status: 'listo', cms: null, hermano: null, cmsCaducada: false },
    ),
  ponerSesiones: ({ cms, hermano }) => set({ status: 'listo', cms, hermano, cmsCaducada: false }),
}))

/** Roles con acceso al CMS/Secretaría (el resto son hermanos rasos: USER) */
export const isStaffRole = (role?: string | null) => !!role && role !== 'USER'
