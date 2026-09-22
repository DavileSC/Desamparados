import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'desamparados-cookies-consent'
const CONSENT_EVENT = 'desamparados-cookie-consent-change'

export type CookieConsent = 'accepted' | 'declined' | null

// localStorage puede lanzar (modo privado, almacenamiento bloqueado, iframes...).
// Nunca debe tumbar la app: sin almacenamiento, el banner simplemente se muestra.
function readConsent(): CookieConsent {
  try {
    if (typeof window === 'undefined') return null
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value === 'accepted' || value === 'declined') return value
    return null
  } catch {
    return null
  }
}

function writeConsent(value: Exclude<CookieConsent, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Sin almacenamiento disponible: la decisión solo dura esta sesión de página
  }
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent>(readConsent)

  // El pie y el banner comparten la decisión también dentro de la misma pestaña.
  useEffect(() => {
    const sync = (event: Event) => setConsent((event as CustomEvent<CookieConsent>).detail)
    const syncStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setConsent(readConsent())
    }
    window.addEventListener(CONSENT_EVENT, sync)
    window.addEventListener('storage', syncStorage)
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  const accept = useCallback(() => {
    writeConsent('accepted')
    setConsent('accepted')
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'accepted' }))
  }, [])

  const decline = useCallback(() => {
    writeConsent('declined')
    setConsent('declined')
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'declined' }))
  }, [])

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Sin almacenamiento disponible, el estado local sigue siendo suficiente.
    }
    setConsent(null)
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }))
  }, [])

  return {
    consent,
    /** true solo si el usuario aceptó explícitamente (cargar terceros: mapas, vídeos...) */
    accepted: consent === 'accepted',
    /** true mientras el usuario no haya decidido: hay que mostrar el banner */
    pending: consent === null,
    accept,
    decline,
    reset,
  }
}
