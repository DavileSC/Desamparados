import { useCallback } from 'react'
import { esEnlaceVivo } from '../lib/destinos'
import { useModulos } from './useModulos'

/**
 * El filtro de enlaces de los bloques de la web pública: `esDestinoValido`
 * más que la página esté encendida (ver `esEnlaceVivo`). Un botón o una
 * tarjeta que lo incumple se pinta sin enlace, como uno con un destino roto.
 */
export function useEnlaceVivo(): (enlace: string) => boolean {
  const { activos } = useModulos()
  return useCallback((enlace: string) => esEnlaceVivo(enlace, activos), [activos])
}
