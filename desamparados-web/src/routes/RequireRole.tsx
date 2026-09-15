import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/members/auth/store'
import PageLoader from '../components/PageLoader'

interface RequireRoleProps {
  roles: string[]
  children: React.ReactNode
}

export default function RequireRole({ roles, children }: RequireRoleProps) {
  const status = useAuthStore((state) => state.status)
  const cms = useAuthStore((state) => state.cms)
  const location = useLocation()

  // Igual que en RequireAuth: sin saber todavía si hay sesión, esperamos.
  if (status === 'cargando') return <PageLoader />

  // El CMS tiene acceso propio, con segundo factor. Sin su sesión se va allí,
  // con `from` para volver a la página que pedía. Tener abierta la del portal
  // del hermano no cuenta: esa no ha pasado el 2FA.
  if (!cms) return <Navigate to="/cms/acceso" state={{ from: location }} replace />
  if (!roles.includes(cms.role)) return <Navigate to="/cms" replace />

  return <>{children}</>
}
