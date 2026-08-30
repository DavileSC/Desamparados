export interface MetaPaginacion {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface RespuestaPaginada<T> {
  data: T[]
  meta: MetaPaginacion
}

/** Construye la cadena de consulta de un listado: `page=2&limit=20&year=2026`. */
export function paramsPagina(
  { pagina, porPagina }: { pagina: number; porPagina: number },
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams({ page: String(pagina), limit: String(porPagina) })
  for (const [clave, valor] of Object.entries(extra)) {
    if (valor) params.set(clave, valor)
  }
  return params.toString()
}
