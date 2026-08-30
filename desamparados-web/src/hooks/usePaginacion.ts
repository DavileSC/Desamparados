import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export const TAMANOS = [10, 20, 30, 40, 50] as const
export const TAMANO_POR_DEFECTO = 20

const CLAVE_MEMORIA = 'desamparados:porPagina'

function tamanoGuardado(): number {
  try {
    const guardado = Number(window.sessionStorage.getItem(CLAVE_MEMORIA))
    return TAMANOS.includes(guardado as (typeof TAMANOS)[number]) ? guardado : TAMANO_POR_DEFECTO
  } catch {
    // sessionStorage puede estar bloqueado; no es motivo para romper la página.
    return TAMANO_POR_DEFECTO
  }
}

/**
 * Página y tamaño en la URL, como ya hace `?vista=` en la pantalla de hermanos:
 * así se vuelve del formulario de edición al mismo sitio, y un enlace lleva a
 * donde dice.
 *
 * El prefijo sirve para las pantallas con dos listados (inventario, hermanos):
 * `usePaginacion('Enseres')` usa `?paginaEnseres=`, que no pisa al otro.
 */
export function usePaginacion(prefijo = '') {
  const [params, setParams] = useSearchParams()
  const clavePagina = `pagina${prefijo}`
  const claveTamano = `porPagina${prefijo}`

  const pedida = Number(params.get(clavePagina))
  const pagina = Number.isInteger(pedida) && pedida >= 1 ? pedida : 1

  const tamanoUrl = Number(params.get(claveTamano))
  const porPagina = TAMANOS.includes(tamanoUrl as (typeof TAMANOS)[number]) ? tamanoUrl : tamanoGuardado()

  const escribir = useCallback((cambios: Record<string, string | null>) => {
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores)
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null) siguientes.delete(clave)
        else siguientes.set(clave, valor)
      }
      return siguientes
    }, { replace: true })
  }, [setParams])

  const irAPagina = useCallback((numero: number) => {
    escribir({ [clavePagina]: numero <= 1 ? null : String(numero) })
  }, [escribir, clavePagina])

  const cambiarTamano = useCallback((numero: number) => {
    try { window.sessionStorage.setItem(CLAVE_MEMORIA, String(numero)) } catch { /* bloqueado: se queda solo en la URL */ }
    escribir({ [claveTamano]: String(numero), [clavePagina]: null })
  }, [escribir, claveTamano, clavePagina])

  /** Al buscar o filtrar: quedarse en la página 7 de otra consulta no tiene sentido. */
  const reiniciar = useCallback(() => { escribir({ [clavePagina]: null }) }, [escribir, clavePagina])

  return { pagina, porPagina, irAPagina, cambiarTamano, reiniciar }
}
