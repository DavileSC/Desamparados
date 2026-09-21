import { useQuery } from '@tanstack/react-query'
import { traerPanelDeHoy } from '../lib/api/panel'

/**
 * La consulta del panel del ejercicio en curso, compartida por el menú (que
 * saca de ahí sus contadores) y por el Inicio. Con la misma clave, TanStack
 * Query la resuelve una sola vez; el `staleTime` evita que cambiar de pantalla
 * dentro del CMS dispare una petición nueva cada vez.
 */
export const CLAVE_PANEL_HOY = ['panel', 'hoy'] as const

export function usePanelDeHoy() {
  return useQuery({
    queryKey: CLAVE_PANEL_HOY,
    queryFn: () => traerPanelDeHoy(),
    staleTime: 5 * 60 * 1000,
  })
}
