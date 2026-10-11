import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { URL_EVENTOS_MESA } from '../../../lib/api/mesa'
import { ErrorDeApi } from '../../../lib/api/cliente'

/** Todo lo que la mesa lee cuelga de esta clave: un aviso de otro puesto la refresca entera. */
export const CLAVE_MESA = ['mesa'] as const

/**
 * Una clave nueva para una operación de la mesa. Con `getRandomValues` y no
 * `randomUUID`: la mesa puede abrirse por la red del salón (http y una IP),
 * donde el navegador no ofrece `randomUUID`.
 */
function nuevaClave(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * La clave de la operación que se está preparando. Se repite en cada
 * reintento (si la WiFi se corta después de cobrar, volver a pulsar no cobra
 * dos veces) y se renueva cuando la operación sale bien.
 */
export function useClaveDeOperacion() {
  const [clave, setClave] = useState(nuevaClave)
  const renovar = useCallback(() => setClave(nuevaClave()), [])
  return { clave, renovar }
}

/**
 * Si el fallo es de la red y no una respuesta del servidor: sin respuesta
 * (el cliente lo da como estado 0) o la de una pasarela que no llegó a él.
 */
const esFalloDeRed = (e: unknown) =>
  !(e instanceof ErrorDeApi) || e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504

/** El aviso de un fallo: si fue la red, se dice que no se perdió nada y que se puede repetir sin miedo. */
export function mensajeDeFallo(e: unknown, porDefecto: string) {
  if (esFalloDeRed(e)) return 'No hay conexión y no se ha guardado. Lo apuntado sigue aquí: vuelve a pulsar cuando vuelva la red (no se cobrará dos veces).'
  return e instanceof Error && e.message ? e.message : porDefecto
}

/**
 * El canal en vivo de la mesa: cada vez que otro puesto apunta, cobra o da la
 * ropa, se vuelve a leer lo que hay en pantalla. Dice también si hay
 * conexión: sin ella, la mesa lo avisa para que nadie crea que ha guardado.
 * El navegador reconecta solo; al reconectar se recarga todo, por si se
 * perdió algún aviso mientras tanto.
 */
export function useMesaEnVivo() {
  const queryClient = useQueryClient()
  const [conectado, setConectado] = useState(true)
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const espera = useRef<number | null>(null)

  useEffect(() => {
    const refrescar = () => {
      // Varios avisos seguidos (cobrar tres cuotas) son una sola recarga.
      if (espera.current !== null) return
      espera.current = window.setTimeout(() => {
        espera.current = null
        void queryClient.invalidateQueries({ queryKey: CLAVE_MESA })
      }, 150)
    }

    const conRed = () => setEnLinea(true)
    const sinRed = () => setEnLinea(false)
    window.addEventListener('online', conRed)
    window.addEventListener('offline', sinRed)

    let canal: EventSource | null = null
    if (typeof EventSource !== 'undefined') {
      canal = new EventSource(URL_EVENTOS_MESA, { withCredentials: true })
      let caido = false
      canal.onopen = () => {
        setConectado(true)
        if (caido) refrescar()
        caido = false
      }
      canal.onmessage = refrescar
      canal.onerror = () => { caido = true; setConectado(false) }
    }

    return () => {
      canal?.close()
      window.removeEventListener('online', conRed)
      window.removeEventListener('offline', sinRed)
      if (espera.current !== null) window.clearTimeout(espera.current)
    }
  }, [queryClient])

  return { conectado: conectado && enLinea }
}
