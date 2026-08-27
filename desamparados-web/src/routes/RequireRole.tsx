import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/members/auth/store'

interface RequireRoleProps {
  roles: string[]
  children: React.ReactNode
}

export default function RequireRole({ roles, children }: RequireRoleProps) {
  const role = useAuthStore((state) => state.user?.role)
  const location = useLocation()

  if (!role) return <Navigate to="/hermanos/acceso" state={{ from: location }} replace />
  if (!roles.includes(role)) return <Navigate to="/area-hermano" replace />

  return <>{children}</>
}
