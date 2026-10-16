import { useQuery, useQueryClient } from '@tanstack/react-query'
import { misFichas, type ApiProfile } from '../../../lib/api/perfil'

/**
 * Las fichas de la cuenta las leen a la vez «Mi perfil» y el selector del menú
 * del área: con una sola consulta, lo que se guarda en una se ve en el otro
 * (un nombre corregido cambia también en el menú).
 */
export const CLAVE_FICHAS = ['area-hermano', 'fichas'] as const

/** La del titular primero; luego las de quienes tiene a su cargo, de mayor a menor. */
const ordenar = (fichas: ApiProfile[]) =>
  [...fichas].sort((a, b) => Number(b.esTitular) - Number(a.esTitular) || a.fechaNacimiento.localeCompare(b.fechaNacimiento))

// Sin argumentos, misFichas pide la familia entera en una sola página: el
// selector elige una ficha, y uno paginado escondería alguna.
export const useFichasDeLaCuenta = () =>
  useQuery({ queryKey: CLAVE_FICHAS, queryFn: () => misFichas().then((r) => ordenar(r.data)) })

/** Tras guardar una ficha, la que devuelve el servidor sustituye a la vieja sin volver a pedirlas todas. */
export function usePonerFicha() {
  const queryClient = useQueryClient()
  return (nueva: ApiProfile) =>
    queryClient.setQueryData<ApiProfile[]>(CLAVE_FICHAS, (actuales) => actuales?.map((f) => (f.id === nueva.id ? nueva : f)))
}

/** «Ana Pérez · n.º 42»: nombre, primer apellido y número, como lo pidió el 16-10-2026. */
export const nombreDeFicha = (f: ApiProfile) => {
  const apellido = (f.primerApellido ?? f.apellidos).trim()
  const numero = f.numeroHermano ? `n.º ${f.numeroHermano}` : 'sin número'
  return `${f.nombre.trim()} ${apellido} · ${numero}`
}
