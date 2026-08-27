import { useState, useCallback } from 'react'

const STORAGE_KEY = 'desamparados-cookies-consent'

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

  const accept = useCallback(() => {
    writeConsent('accepted')
    setConsent('accepted')
  }, [])

  const decline = useCallback(() => {
    writeConsent('declined')
    setConsent('declined')
  }, [])

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Sin almacenamiento disponible, el estado local sigue siendo suficiente.
    }
    setConsent(null)
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
