import { useState, useCallback, useEffect } from 'react'

const CLAVE_GUARDADA = 'desamparados-cookies-consent'
const EVENTO_DECISION = 'desamparados-cookie-consent-change'

/**
 * Los dos valores que se guardan en el navegador siguen siendo `accepted` y
 * `declined`, en inglés y con esa misma clave: cambiarlos dejaría sin efecto la
 * decisión que ya tomaron los visitantes y les volvería a salir el aviso.
 */
export type Consentimiento = 'accepted' | 'declined' | null

// localStorage puede lanzar (modo privado, almacenamiento bloqueado, iframes...).
// Nunca debe tumbar la app: sin almacenamiento, el banner simplemente se muestra.
function leerDecision(): Consentimiento {
  try {
    if (typeof window === 'undefined') return null
    const guardado = window.localStorage.getItem(CLAVE_GUARDADA)
    if (guardado === 'accepted' || guardado === 'declined') return guardado
    return null
  } catch {
    return null
  }
}

function guardarDecision(valor: Exclude<Consentimiento, null>) {
  try {
    window.localStorage.setItem(CLAVE_GUARDADA, valor)
  } catch {
    // Sin almacenamiento disponible: la decisión solo dura esta sesión de página
  }
}

export function useConsentimientoDeCookies() {
  const [decision, setDecision] = useState<Consentimiento>(leerDecision)

  // El pie y el banner comparten la decisión también dentro de la misma pestaña.
  useEffect(() => {
    const sincronizar = (evento: Event) => setDecision((evento as CustomEvent<Consentimiento>).detail)
    const sincronizarAlmacen = (evento: StorageEvent) => {
      if (evento.key === CLAVE_GUARDADA || evento.key === null) setDecision(leerDecision())
    }
    window.addEventListener(EVENTO_DECISION, sincronizar)
    window.addEventListener('storage', sincronizarAlmacen)
    return () => {
      window.removeEventListener(EVENTO_DECISION, sincronizar)
      window.removeEventListener('storage', sincronizarAlmacen)
    }
  }, [])

  const aceptar = useCallback(() => {
    guardarDecision('accepted')
    setDecision('accepted')
    window.dispatchEvent(new CustomEvent(EVENTO_DECISION, { detail: 'accepted' }))
  }, [])

  const rechazar = useCallback(() => {
    guardarDecision('declined')
    setDecision('declined')
    window.dispatchEvent(new CustomEvent(EVENTO_DECISION, { detail: 'declined' }))
  }, [])

  const volverAPreguntar = useCallback(() => {
    try {
      window.localStorage.removeItem(CLAVE_GUARDADA)
    } catch {
      // Sin almacenamiento disponible, el estado local sigue siendo suficiente.
    }
    setDecision(null)
    window.dispatchEvent(new CustomEvent(EVENTO_DECISION, { detail: null }))
  }, [])

  return {
    decision,
    /** true solo si el visitante aceptó explícitamente (cargar terceros: mapas, vídeos...) */
    aceptadas: decision === 'accepted',
    /** true mientras no haya decidido: hay que mostrar el aviso */
    sinDecidir: decision === null,
    aceptar,
    rechazar,
    volverAPreguntar,
  }
}
