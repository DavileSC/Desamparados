import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/members/auth/store'

interface RequireAuthProps {
  children: React.ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/hermanos/acceso" state={{ from: location }} replace />
  }

  return <>{children}</>
}
