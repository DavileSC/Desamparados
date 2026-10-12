import { useMemo } from 'react'
import { menuPublico, menuVisible, ponerNombres, type EntradaMenu } from '../config/navegacion'
import { useModulos } from './useModulos'
import { useNombresEnMenu } from './useNombresEnMenu'

/**
 * El menú de la web con los módulos encendidos; vacío mientras no se saben (no
 * se pinta nada a medias). Si la lista no llega (la API caída), lo del núcleo:
 * antes desaparecía el menú entero y la web se quedaba sin navegación.
 * Con los nombres del CMS puestos; mientras llegan, los de siempre (no se
 * espera por ellos: un menú con «Parroquia» un instante es mejor que ninguno).
 */
export function useMenuPublico(): EntradaMenu[] {
  const { activos, error } = useModulos()
  const nombres = useNombresEnMenu()
  return useMemo(
    () => ponerNombres(activos ? menuVisible(menuPublico, activos) : error ? menuVisible(menuPublico, new Set()) : [], nombres),
    [activos, error, nombres],
  )
}
