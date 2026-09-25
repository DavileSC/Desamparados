import { createContext, useContext } from 'react'

/**
 * La página se está pintando dentro del constructor del CMS (la vista en vivo):
 * los bloques ocultos o programados se ven, atenuados y con su aviso, el que
 * está abierto en el editor se resalta, y pulsar uno lo abre en el editor.
 *
 * Fuera del CMS no hay contexto (`null`) y la página se pinta tal cual la ve
 * cualquiera: los ocultos no salen.
 */
export interface ModoEdicion {
  /** La posición del bloque abierto en el editor, o `null`. */
  seleccionado: number | null
  /** Se ha pulsado el bloque de esa posición. */
  alPulsar: (indice: number) => void
}

export const ModoEdicionContext = createContext<ModoEdicion | null>(null)

export const useModoEdicion = () => useContext(ModoEdicionContext)
