import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/members/auth/store'
import PageLoader from '../components/PageLoader'

interface RequireAuthProps {
  children: React.ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  // Mientras no sepamos si hay sesión no podemos mandar a nadie al login:
  // expulsaría a quien sí la tiene cada vez que recarga la página.
  if (status === 'cargando') return <PageLoader />

  if (status !== 'autenticado') {
    return <Navigate to="/hermanos/acceso" state={{ from: location }} replace />
  }

  return <>{children}</>
}
