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
  const location = useLocation()

  // Igual que en RequireAuth: sin saber todavía si hay sesión, esperamos.
  if (status === 'cargando') return <PageLoader />

  if (!role) return <Navigate to="/hermanos/acceso" state={{ from: location }} replace />
  if (!roles.includes(role)) return <Navigate to="/area-hermano" replace />

  return <>{children}</>
}
