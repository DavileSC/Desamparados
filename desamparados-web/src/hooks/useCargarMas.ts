import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query'
import type { MetaPaginacion } from '../lib/api/tipos'
import type { Pagina } from './useListadoPaginado'

/**
 * Cuánto se guarda lo cargado sin nadie mirándolo. Lo bastante para leer una
 * noticia y volver: al regresar el archivo sale al momento con las mismas, sin
 * esqueleto, y el navegador puede devolver el scroll a donde estaba.
 */
const GUARDADO_MS = 10 * 60_000

/** Un tramo de la lista: lo que se trae con cada «Cargar más». */
interface Tramo<T> { data: T[]; total: number }

/**
 * Los elementos [inicio, fin) de una API que pagina por páginas de tamaño fijo.
 * Con páginas del tamaño del tramo, el tramo cae como mucho en dos de ellas:
 * se piden esas y se recorta. Así la primera carga (10) y los lotes (9) no
 * tienen que coincidir con el tamaño de página del servidor.
 */
async function traerTramo<T>(
  pedir: (pagina: Pagina) => Promise<{ data: T[]; meta: MetaPaginacion }>,
  inicio: number,
  fin: number,
): Promise<Tramo<T>> {
  const porPagina = fin - inicio
  const primera = Math.floor(inicio / porPagina) + 1
  const ultima = Math.ceil(fin / porPagina)
  const todas: T[] = []
  let total = 0
  for (let pagina = primera; pagina <= ultima; pagina++) {
    const { data, meta } = await pedir({ pagina, porPagina })
    todas.push(...data)
    total = meta.total
    if (data.length < porPagina) break
  }
  const desplazamiento = (primera - 1) * porPagina
  return { data: todas.slice(inicio - desplazamiento, fin - desplazamiento), total }
}

/**
 * Un listado público con «Cargar más» en vez de paginador: enseña las
 * `primera` primeras y cada vez que se pulsa, `lote` más debajo.
 *
 * Cuántas se ven va en la dirección (`?mostrar=19`), como antes la página: una
 * dirección compartida abre con las mismas. Lo cargado vive en la caché de
 * React Query bajo `clave`, y no en el estado del componente: antes, volver
 * atrás desde una noticia montaba el archivo de cero y lo pedía todo otra vez
 * desde la primera página, con el esqueleto delante y el scroll arriba.
 * `pedir` tiene que ser estable, como en `useListadoPaginado`.
 */
export function useCargarMas<T>(
  clave: QueryKey,
  pedir: (pagina: Pagina) => Promise<{ data: T[]; meta: MetaPaginacion }>,
  mensajeError: string,
  { primera, lote }: { primera: number; lote: number },
) {
  const [params, setParams] = useSearchParams()
  const pedidas = Number(params.get('mostrar'))
  const mostrar = Number.isInteger(pedidas) && pedidas > primera ? pedidas : primera

  const consulta = useInfiniteQuery({
    queryKey: [...clave, { primera, lote }],
    initialPageParam: 0,
    queryFn: ({ pageParam: inicio }) => traerTramo(pedir, inicio, inicio === 0 ? primera : inicio + lote),
    getNextPageParam: (ultimo, tramos) => {
      const cargadas = tramos.reduce((suma, t) => suma + t.data.length, 0)
      return ultimo.data.length > 0 && cargadas < ultimo.total ? cargadas : undefined
    },
    gcTime: GUARDADO_MS,
  })
  const { data, error, hasNextPage, isFetchingNextPage, isPending, fetchNextPage, refetch } = consulta

  const todas = data?.pages.flatMap((t) => t.data) ?? []
  const total = data?.pages.at(-1)?.total ?? null
  const faltan = todas.length < mostrar && hasNextPage
  const items = todas.slice(0, mostrar)

  // Lo que pide la dirección y aún no está en la caché (una dirección con
  // ?mostrar=28, o el botón recién pulsado): un tramo cada vez.
  useEffect(() => {
    if (faltan && !isFetchingNextPage && !error) void fetchNextPage()
  }, [faltan, isFetchingNextPage, error, fetchNextPage])

  /** Con un fallo, vuelve a pedir lo mismo; si no, `lote` más. */
  const cargarMas = useCallback(() => {
    if (error) {
      void (data ? fetchNextPage() : refetch())
      return
    }
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores)
      siguientes.set('mostrar', String(Math.max(mostrar, items.length) + lote))
      siguientes.delete('pagina')
      return siguientes
      // Sin `preventScrollReset`, el ScrollRestoration del router tomaba el
      // cambio de dirección por una página nueva y subía arriba del todo.
    }, { replace: true, preventScrollReset: true })
  }, [error, data, fetchNextPage, refetch, mostrar, items.length, lote, setParams])

  return {
    items,
    total,
    /** Aún no ha llegado nada: la lista entera está cargando. */
    loading: isPending && !error,
    /** Ya hay lista y se están pidiendo más. */
    cargandoMas: !isPending && (isFetchingNextPage || (faltan && !error)),
    hayMas: total !== null && items.length < total,
    error: error ? (error.message || mensajeError) : null,
    cargarMas,
  }
}
