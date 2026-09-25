import { useCallback, useState } from 'react'

/** Cuántos pasos atrás se recuerdan. Más, y una tarde de edición pesaría en memoria sin que nadie los use. */
const PASOS = 100

/**
 * Dos cambios del mismo grupo (el mismo campo) seguidos en menos de este tiempo
 * cuentan como uno: escribir «Sábado de Pasión» no son dieciséis pasos atrás.
 */
const AGRUPAR_MS = 1000

interface Historia<T> {
  pasado: T[]
  presente: T
  futuro: T[]
  /** El grupo y la hora del último cambio, para juntar los que van seguidos. */
  ultimo: { grupo: string; hora: number } | null
}

/**
 * Deshacer y rehacer para un estado entero (el documento del constructor).
 *
 * - `fijar(nuevo, grupo)` guarda un paso. Con `grupo`, los cambios del mismo
 *   grupo que llegan seguidos se juntan en uno (teclear en un campo).
 * - `reiniciar(valor)` empieza de cero, sin historia: al cargar la página o
 *   después de guardar, deshacer no debe volver a antes de lo guardado.
 */
export function useDeshacer<T>(inicial: T) {
  const [historia, setHistoria] = useState<Historia<T>>({ pasado: [], presente: inicial, futuro: [], ultimo: null })

  const fijar = useCallback((nuevo: T | ((actual: T) => T), grupo?: string) => {
    setHistoria((h) => {
      const valor = typeof nuevo === 'function' ? (nuevo as (actual: T) => T)(h.presente) : nuevo
      if (Object.is(valor, h.presente)) return h
      const ahora = Date.now()
      const junta = grupo !== undefined && h.ultimo?.grupo === grupo && ahora - h.ultimo.hora < AGRUPAR_MS
      return {
        pasado: junta ? h.pasado : [...h.pasado, h.presente].slice(-PASOS),
        presente: valor,
        futuro: [],
        ultimo: grupo !== undefined ? { grupo, hora: ahora } : null,
      }
    })
  }, [])

  const deshacer = useCallback(() => {
    setHistoria((h) => (h.pasado.length === 0 ? h : {
      pasado: h.pasado.slice(0, -1),
      presente: h.pasado[h.pasado.length - 1],
      futuro: [h.presente, ...h.futuro],
      ultimo: null,
    }))
  }, [])

  const rehacer = useCallback(() => {
    setHistoria((h) => (h.futuro.length === 0 ? h : {
      pasado: [...h.pasado, h.presente],
      presente: h.futuro[0],
      futuro: h.futuro.slice(1),
      ultimo: null,
    }))
  }, [])

  const reiniciar = useCallback((valor: T) => setHistoria({ pasado: [], presente: valor, futuro: [], ultimo: null }), [])

  return {
    estado: historia.presente,
    fijar,
    deshacer,
    rehacer,
    reiniciar,
    puedeDeshacer: historia.pasado.length > 0,
    puedeRehacer: historia.futuro.length > 0,
  }
}
