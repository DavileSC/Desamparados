import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CLAVE_SALIDAS, salidas, salidasDelCms } from '../../lib/api/salidas'

/** `enabled` falso no pide nada: una pantalla que solo usa las salidas con Procesión encendida no las pide apagada. */
export function useSalidas({ delCms = false, enabled = true }: { delCms?: boolean; enabled?: boolean } = {}) {
  return useQuery({ queryKey: [...CLAVE_SALIDAS, delCms ? 'cms' : 'web'], queryFn: delCms ? salidasDelCms : salidas, enabled })
}

const leer = (clave: string) => { try { return localStorage.getItem(clave) } catch { return null } }
const guardar = (clave: string, valor: string) => { try { localStorage.setItem(clave, valor) } catch { /* sin almacenamiento: no se recuerda */ } }

/** La salida con la que trabaja una pantalla, recordada por slug: con un id, una salida borrada y creada de nuevo se confundiría. */
export function useSalidaElegida(recordar: string) {
  const { data = [], isLoading, isError } = useSalidas()
  const [slug, setSlug] = useState(() => leer(recordar))
  const salida = data.find((s) => s.slug === slug) ?? data[0] ?? null
  const elegir = (nuevo: string) => { setSlug(nuevo); guardar(recordar, nuevo) }
  // Sin salidas por un fallo no es lo mismo que sin salidas activas: la pantalla lo dice distinto.
  return { salidas: data, salida, elegir, cargando: isLoading, error: isError }
}
