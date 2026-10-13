import { useQuery } from '@tanstack/react-query'
import { CLAVE_NOMBRES_EN_MENU, NOMBRE_DE_SIEMPRE, nombresEnMenu, type NombresEnMenu } from '../lib/api/menu'

const NINGUNO: NombresEnMenu = {}

/**
 * Los nombres del menú guardados en el CMS, pedidos una vez y compartidos por
 * la barra, el cajón, el pie y las cejas. Mientras llegan, o si fallan, ninguno:
 * el menú sale con los de siempre en vez de quedarse en blanco. Se piden al
 * arrancar (`App.tsx`) y las pruebas los siembran vacíos (`test/queryClient.ts`).
 */
export function useNombresEnMenu(): NombresEnMenu {
  const { data } = useQuery({ queryKey: CLAVE_NOMBRES_EN_MENU, queryFn: nombresEnMenu, staleTime: 10 * 60_000 })
  return data ?? NINGUNO
}

/**
 * El nombre de una entrada en el menú (el guardado o el de siempre), para lo
 * que la nombra fuera del menú: el botón de la barra, el del cajón, el título
 * y la pestaña de una página que no es de bloques. Así el menú, la ceja y el
 * título dicen lo mismo.
 */
export function useNombreEnMenu(ruta: string): string {
  return useNombresEnMenu()[ruta] ?? NOMBRE_DE_SIEMPRE.get(ruta) ?? ruta
}
