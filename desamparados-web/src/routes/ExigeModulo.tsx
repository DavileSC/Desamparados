import { Suspense, lazy } from 'react'
import { useLocation } from 'react-router-dom'
import CargandoPagina from '../components/CargandoPagina'
import { useModulos } from '../hooks/useModulos'
import { cumple, type Requisito } from '../domain/modulos'

const NoEncontradaPage = lazy(() => import('../features/noEncontrado/NoEncontradaPage'))
const ModuloNoActivadoPage = lazy(() => import('../features/cms/ModuloNoActivadoPage'))

/**
 * La guarda de módulo de una ruta. `nucleo` pasa sin esperar a nada: la
 * portada no puede quedarse en blanco hasta que llegue la lista. Una ruta de
 * módulo espera a la lista; apagado, en la web pública es un «no encontrado»
 * como cualquier dirección que no existe y en el CMS una explicación. Si la
 * lista no llega (la API caída), se deja pasar: la propia pantalla enseñará
 * su error, que es más útil que un 404 falso.
 */
export default function ExigeModulo({ modulo, children }: { modulo: Requisito; children: React.ReactNode }) {
  const { activos, error } = useModulos()
  const { pathname } = useLocation()
  const esNucleo = Array.isArray(modulo) ? modulo.includes('nucleo') : modulo === 'nucleo'
  if (esNucleo) return <>{children}</>
  if (activos === null) return error ? <>{children}</> : <CargandoPagina />
  if (cumple(modulo, activos)) return <>{children}</>
  return (
    <Suspense fallback={<CargandoPagina />}>
      {pathname.startsWith('/cms') ? <ModuloNoActivadoPage modulo={modulo} /> : <NoEncontradaPage />}
    </Suspense>
  )
}
