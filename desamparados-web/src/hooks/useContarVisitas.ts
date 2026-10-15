import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useModulos } from './useModulos'

/**
 * Cuenta cada página vista de la web pública para las estadísticas de visitas
 * (módulo «estadisticas-de-visitas», con GoAccess en el servidor). La web es
 * una SPA: al moverse por el menú el servidor no ve nada, así que se le avisa
 * con una petición mínima a nginx, que solo la apunta (docker/nginx/comun.conf).
 *
 * No hay cookies ni nada guardado en el navegador, y solo viaja la ruta, sin
 * su consulta (ahí van los tokens y las búsquedas), y, en la primera página,
 * el sitio del que se llega. Quien pide no ser seguido (Global Privacy
 * Control, Do Not Track) no se cuenta.
 */
export function useContarVisitas() {
  const { pathname } = useLocation()
  const { activo } = useModulos()
  const encendido = activo('estadisticas-de-visitas')
  // La procedencia solo vale para la página por la que se entra.
  const primera = useRef(true)

  useEffect(() => {
    // En desarrollo no hay nginx delante: cada página sería un 404.
    if (!encendido || import.meta.env.MODE === 'development' || pideNoSerSeguido()) return
    const procedencia = primera.current ? procedenciaDeFuera() : null
    primera.current = false
    enviar(urlDeVisita(pathname, procedencia))
  }, [pathname, encendido])
}

/**
 * `/visita?ruta=…&ref=…`. La ruta llega ya codificada del navegador (una «ñ»
 * es %C3%B1): solo se codifica lo que partiría la consulta.
 */
export function urlDeVisita(ruta: string, procedencia: string | null): string {
  const limpio = (texto: string) => texto.replace(/[&#?+\s"]/g, encodeURIComponent)
  return `/visita?ruta=${limpio(ruta)}${procedencia ? `&ref=${limpio(procedencia)}` : ''}`
}

/** El sitio del que se llega, sin su ruta («https://www.google.com/»); nada si es esta misma web. */
export function procedenciaDeFuera(referrer = document.referrer, aqui = window.location.host): string | null {
  try {
    const url = new URL(referrer)
    if (url.host === aqui || !/^https?:$/.test(url.protocol)) return null
    return `${url.origin}/`
  } catch {
    return null
  }
}

function pideNoSerSeguido(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

function enviar(url: string) {
  // sendBeacon no espera respuesta ni frena la navegación.
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url)) return
  void fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
}
