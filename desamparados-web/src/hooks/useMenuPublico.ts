import { useMemo } from 'react'
import { menuPublico, menuVisible, type EntradaMenu } from '../config/navegacion'
import { useModulos } from './useModulos'

/**
 * El menú de la web con los módulos encendidos; vacío mientras no se saben (no
 * se pinta nada a medias). Si la lista no llega (la API caída), lo del núcleo:
 * antes desaparecía el menú entero y la web se quedaba sin navegación.
 */
export function useMenuPublico(): EntradaMenu[] {
  const { activos, error } = useModulos()
  return useMemo(
    () => (activos ? menuVisible(menuPublico, activos) : error ? menuVisible(menuPublico, new Set()) : []),
    [activos, error],
  )
}
