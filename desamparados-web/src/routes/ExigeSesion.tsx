import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/altas/auth/store'
import CargandoPagina from '../components/CargandoPagina'

interface ExigeSesionProps {
  children: React.ReactNode
  /** Es la revisión del primer acceso: la única pantalla que ve quien la tiene pendiente. */
  revision?: boolean
}

export default function ExigeSesion({ children, revision = false }: ExigeSesionProps) {
  const estado = useAuthStore((state) => state.status)
  const hermano = useAuthStore((state) => state.hermano)
  const location = useLocation()

  // Mientras no sepamos qué sesiones hay no podemos mandar a nadie al login:
  // expulsaría a quien sí la tiene cada vez que recarga la página.
  if (estado === 'cargando') return <CargandoPagina />

  // Solo la sesión del área de hermanos abre el área de hermanos. Estar dentro
  // del CMS no es estar dentro del portal: son dos accesos distintos.
  if (!hermano) {
    return <Navigate to="/acceso" state={{ from: location }} replace />
  }

  // Quien vino con el censo importado revisa su ficha antes que nada; y la
  // revisión, ya hecha, no se vuelve a ver.
  const pendiente = hermano.primerAccesoPendiente === true
  if (pendiente && !revision) return <Navigate to="/primer-acceso/ficha" replace />
  if (!pendiente && revision) return <Navigate to="/area-hermano" replace />

  return <>{children}</>
}
