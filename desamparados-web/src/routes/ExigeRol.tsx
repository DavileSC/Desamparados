import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/altas/auth/store'
import CargandoPagina from '../components/CargandoPagina'

interface ExigeRolProps {
  roles: string[]
  children: React.ReactNode
}

export default function ExigeRol({ roles, children }: ExigeRolProps) {
  const estado = useAuthStore((state) => state.status)
  const cms = useAuthStore((state) => state.cms)
  const location = useLocation()

  // Igual que en ExigeSesion: sin saber todavía si hay sesión, esperamos.
  if (estado === 'cargando') return <CargandoPagina />

  // El CMS tiene acceso propio, con segundo factor. Sin su sesión se va allí,
  // con `from` para volver a la página que pedía. Tener abierta la del portal
  // del hermano no cuenta: esa no ha pasado el 2FA.
  if (!cms) return <Navigate to="/cms/acceso" state={{ from: location }} replace />
  if (!roles.includes(cms.role)) return <Navigate to="/cms" replace />

  return <>{children}</>
}
