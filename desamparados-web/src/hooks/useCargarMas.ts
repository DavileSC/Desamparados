import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MetaPaginacion } from '../lib/api/tipos'
import type { Pagina } from './useListadoPaginado'

/** Lo más que da el servidor en una petición (`LIMITE_MAXIMO` en el backend). */
const TOPE_DEL_SERVIDOR = 100

/**
 * Un listado público con «Cargar más» en vez de paginador: enseña las
 * `primera` primeras y cada vez que se pulsa, `lote` más debajo.
 *
 * Cuántas se ven va en la dirección (`?mostrar=19`), como antes la página: al
 * volver desde la ficha de un elemento siguen cargadas las mismas, y no hay
 * que pulsar otra vez hasta llegar a donde se estaba.
 *
 * Se piden siempre las N primeras de una vez (en tandas de 100, el tope del
 * servidor) y no solo las nuevas: la API pagina por páginas de tamaño fijo, y
 * con una primera carga distinta del lote los saltos no cuadrarían. Una lista
 * de noticias pesa poco. `pedir` tiene que ser estable, como en
 * `useListadoPaginado`.
 */
export function useCargarMas<T>(
  pedir: (pagina: Pagina) => Promise<{ data: T[]; meta: MetaPaginacion }>,
  mensajeError: string,
  { primera, lote }: { primera: number; lote: number },
) {
  const [params, setParams] = useSearchParams()
  const pedidas = Number(params.get('mostrar'))
  const mostrar = Number.isInteger(pedidas) && pedidas > primera ? pedidas : primera

  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState<number | null>(null)
  /** Cuántas se pidieron para los `items` que hay: si no coincide con `mostrar`, se están cargando más. */
  const [cargadas, setCargadas] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  /** Se ha pulsado el botón y aún no ha vuelto la respuesta (también al reintentar). */
  const [pidiendo, setPidiendo] = useState(false)

  useEffect(() => {
    let cancelado = false
    const traer = async () => {
      const todas: T[] = []
      let cuantas = Infinity
      for (let pagina = 1; todas.length < Math.min(mostrar, cuantas); pagina++) {
        const porPagina = Math.min(mostrar, TOPE_DEL_SERVIDOR)
        const { data, meta } = await pedir({ pagina, porPagina })
        todas.push(...data)
        cuantas = meta.total
        if (data.length < porPagina) break
      }
      return { todas: todas.slice(0, mostrar), cuantas: Number.isFinite(cuantas) ? cuantas : todas.length }
    }
    traer()
      .then(({ todas, cuantas }) => {
        if (cancelado) return
        setItems(todas)
        setTotal(cuantas)
        setCargadas(mostrar)
        setError(null)
        setPidiendo(false)
      })
      .catch((err: unknown) => {
        if (cancelado) return
        setError(err instanceof Error ? err.message : mensajeError)
        // Lo que no se pudo traer cuenta como intentado: el botón vuelve a
        // estar disponible para reintentar, y lo ya cargado sigue a la vista.
        setCargadas(mostrar)
        setPidiendo(false)
      })
    return () => { cancelado = true }
  }, [pedir, mensajeError, mostrar, intento])

  /** Con un fallo, vuelve a pedir lo mismo; si no, `lote` más. */
  const cargarMas = useCallback(() => {
    setPidiendo(true)
    if (error) { setIntento((n) => n + 1); return }
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores)
      siguientes.set('mostrar', String(Math.max(mostrar, items.length) + lote))
      siguientes.delete('pagina')
      return siguientes
      // Sin `preventScrollReset`, el ScrollRestoration del router tomaba el
      // cambio de dirección por una página nueva y subía arriba del todo.
    }, { replace: true, preventScrollReset: true })
  }, [error, mostrar, items.length, lote, setParams])

  const primeraCarga = cargadas === 0
  return {
    items,
    total,
    /** Aún no ha llegado nada: la lista entera está cargando. */
    loading: primeraCarga && !error,
    /** Ya hay lista y se están pidiendo más. */
    cargandoMas: !primeraCarga && (pidiendo || cargadas !== mostrar),
    hayMas: total !== null && items.length < total,
    error,
    cargarMas,
  }
}
