import { useMemo } from 'react'
import { menuPublico, menuVisible, type EntradaMenu } from '../config/navegacion'
import { useModulos } from './useModulos'

/** El menú de la web con los módulos encendidos; vacío mientras no se saben (no se pinta nada a medias). */
export function useMenuPublico(): EntradaMenu[] {
  const { activos } = useModulos()
  return useMemo(() => (activos ? menuVisible(menuPublico, activos) : []), [activos])
}
