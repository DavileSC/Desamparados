import { lazy, Suspense } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/altas/auth/store'
import CargandoPagina from '../components/CargandoPagina'

// Diferida: este guarda va en el bundle de entrada y la pantalla trae el tema del CMS.
const ActivarDobleFactor = lazy(() => import('../features/altas/auth/ActivarDobleFactor'))

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
  // del hermano no cuenta: esa no ha pasado el 2FA. Una sesión que caduca con
  // alguien dentro no llega aquí como `null` (ver `cmsCaducada` en el store):
  // la pantalla sigue montada y el marco pide volver a entrar en una ventana.
  if (!cms) return <Navigate to="/cms/acceso" state={{ from: location }} replace />

  // El 2FA es obligatorio para el equipo: sin él, el servidor solo deja
  // activarlo, así que en lugar del CMS (y de su menú, que pediría datos que
  // no van a llegar) se enseña la pantalla para hacerlo. La URL no cambia:
  // al terminar, aparece la página que se pedía.
  if (!cms.twoFactorEnabled) {
    return <Suspense fallback={<CargandoPagina />}><ActivarDobleFactor /></Suspense>
  }

  if (!roles.includes(cms.role)) return <Navigate to="/cms" replace />

  return <>{children}</>
}
