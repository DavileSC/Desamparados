import { useQuery } from '@tanstack/react-query'
import { CLAVE_NOMBRES_EN_MENU, nombresEnMenu, type NombresEnMenu } from '../lib/api/menu'

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
