import { useState, useCallback, useEffect } from 'react'

const CLAVE_GUARDADA = 'desamparados-cookies-consent'
const EVENTO_DECISION = 'desamparados-cookie-consent-change'
/** Cuándo se decidió, en milisegundos: en una clave aparte para no tocar la de antes (ver abajo). */
const CLAVE_FECHA = 'desamparados-cookies-consent-fecha'
/**
 * La AEPD recomienda volver a preguntar como mucho cada 24 meses (Guía sobre
 * el uso de las cookies, 2023): pasado ese plazo, el aviso sale otra vez.
 */
export const VIGENCIA_DECISION_MS = 730 * 24 * 60 * 60 * 1000

/**
 * Los dos valores que se guardan en el navegador siguen siendo `accepted` y
 * `declined`, en inglés y con esa misma clave: cambiarlos dejaría sin efecto la
 * decisión que ya tomaron los visitantes y les volvería a salir el aviso.
 */
type Consentimiento = 'accepted' | 'declined' | null

// localStorage puede lanzar (modo privado, almacenamiento bloqueado, iframes...).
// Nunca debe tumbar la app: sin almacenamiento, el banner simplemente se muestra.
function leerDecision(): Consentimiento {
  try {
    if (typeof window === 'undefined') return null
    const guardado = window.localStorage.getItem(CLAVE_GUARDADA)
    if (guardado !== 'accepted' && guardado !== 'declined') return null
    const fecha = Number(window.localStorage.getItem(CLAVE_FECHA))
    if (!fecha) {
      // Una decisión de antes de guardar la fecha: los 24 meses empiezan hoy.
      window.localStorage.setItem(CLAVE_FECHA, String(Date.now()))
      return guardado
    }
    if (Date.now() - fecha > VIGENCIA_DECISION_MS) {
      window.localStorage.removeItem(CLAVE_GUARDADA)
      window.localStorage.removeItem(CLAVE_FECHA)
      return null
    }
    return guardado
  } catch {
    return null
  }
}

function guardarDecision(valor: Exclude<Consentimiento, null>) {
  try {
    window.localStorage.setItem(CLAVE_GUARDADA, valor)
    window.localStorage.setItem(CLAVE_FECHA, String(Date.now()))
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
      window.localStorage.removeItem(CLAVE_FECHA)
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
