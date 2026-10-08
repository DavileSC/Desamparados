import { useRouteError } from 'react-router-dom'
import { AvisoDeError } from './RedDeErrores'
import { esFalloDeTrozo, recargarUnaVez } from '../lib/recargaTrasDespliegue'

/**
 * El `errorElement` del router. El router captura los errores de sus rutas
 * antes que `RedDeErrores`, y sin esto pintaba su pantalla por defecto, en
 * inglés y sin salida. Si lo que falló es un trozo de código que ya no existe
 * (la web cambió mientras estaba abierta), se recarga una vez y no se ve nada.
 */
export default function ErrorDeRuta() {
  const error = useRouteError()
  if (esFalloDeTrozo(error) && recargarUnaVez()) return null
  console.error('[ErrorDeRuta] Error no controlado en la interfaz:', error)
  return <AvisoDeError />
}
