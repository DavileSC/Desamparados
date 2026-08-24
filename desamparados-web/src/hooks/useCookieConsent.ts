import { useState, useCallback } from 'react'

const STORAGE_KEY = 'desamparados-cookies-accepted'

function getInitialConsent(): boolean | null {
  if (typeof window === 'undefined') return null
  const value = localStorage.getItem(STORAGE_KEY)
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export function useCookieConsent() {
  const [accepted, setAccepted] = useState<boolean | null>(getInitialConsent)

  const accept = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setAccepted(true)
  }, [])

  const decline = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'false')
    setAccepted(true)
  }, [])

  return { accepted, accept, decline }
}
