import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/members/auth/store'
import PageLoader from '../components/PageLoader'

interface RequireRoleProps {
  roles: string[]
  children: React.ReactNode
}

export default function RequireRole({ roles, children }: RequireRoleProps) {
  const status = useAuthStore((state) => state.status)
  const role = useAuthStore((state) => state.user?.role)
  const origen = useAuthStore((state) => state.user?.origen)
  const location = useLocation()

  // Igual que en RequireAuth: sin saber todavía si hay sesión, esperamos.
  if (status === 'cargando') return <PageLoader />

  // El CMS tiene acceso propio: un visitante sin sesión aterriza allí, con
  // `from` para volver a la página que pedía al identificarse.
  // Además, el CMS solo acepta sesiones nacidas en /cms/acceso, donde se exige el 2FA.
  if (!role || origen !== 'cms') return <Navigate to="/cms/acceso" state={{ from: location }} replace />
  if (!roles.includes(role)) return <Navigate to="/area-hermano" replace />

  return <>{children}</>
}
