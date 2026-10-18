import { useQuery } from '@tanstack/react-query'
import { CLAVE_ESTADO_DE_LA_WEB, estadoDeLaWeb, type EstadoDeLaWeb } from '../lib/api/web'

/**
 * Si la web está abierta. Se pide al arrancar (`App.tsx`) y las pruebas lo
 * siembran abierta (`test/queryClient.ts`). `undefined` mientras llega: el
 * marco público espera en vez de enseñar un instante la web cerrada.
 */
export function useEstadoDeLaWeb(): { estado: EstadoDeLaWeb | undefined; fallo: boolean } {
  const { data, isError } = useQuery({ queryKey: CLAVE_ESTADO_DE_LA_WEB, queryFn: estadoDeLaWeb, staleTime: 10 * 60_000 })
  return { estado: data, fallo: isError }
}
