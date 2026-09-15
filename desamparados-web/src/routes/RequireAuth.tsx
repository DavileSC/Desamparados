import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/members/auth/store'
import PageLoader from '../components/PageLoader'

interface RequireAuthProps {
  children: React.ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const status = useAuthStore((state) => state.status)
  const hermano = useAuthStore((state) => state.hermano)
  const location = useLocation()

  // Mientras no sepamos qué sesiones hay no podemos mandar a nadie al login:
  // expulsaría a quien sí la tiene cada vez que recarga la página.
  if (status === 'cargando') return <PageLoader />

  // Solo la sesión del área de hermanos abre el área de hermanos. Estar dentro
  // del CMS no es estar dentro del portal: son dos accesos distintos.
  if (!hermano) {
    return <Navigate to="/hermanos/acceso" state={{ from: location }} replace />
  }

  return <>{children}</>
}
