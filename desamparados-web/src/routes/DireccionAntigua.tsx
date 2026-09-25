import { Suspense, lazy } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import CargandoPagina from '../components/CargandoPagina'

const NoEncontradaPage = lazy(() => import('../features/noEncontrado/NoEncontradaPage'))

/**
 * Hasta el 25-09-2026 las páginas colgaban de su sección
 * (/corporacion/historia, /actualidad/noticias/<noticia>, /hermanos/acceso…).
 * Al quitar las portadas de sección se quedaron sin ese primer tramo; esto
 * lleva cada dirección vieja a la nueva, con su `?` y su `#`, para que los
 * enlaces compartidos y lo que tiene Google no acaben en un 404.
 *
 * La portada de la sección sola (/corporacion) no tiene a dónde ir: se quitó a
 * propósito y da «Página no encontrada».
 */
export default function DireccionAntigua() {
  const { pathname, search, hash } = useLocation()
  const resto = pathname.replace(/^\/[^/]+/, '').replace(/\/+$/, '')
  if (!resto) {
    return (
      <Suspense fallback={<CargandoPagina />}>
        <NoEncontradaPage />
      </Suspense>
    )
  }
  return <Navigate to={`${resto}${search}${hash}`} replace />
}
