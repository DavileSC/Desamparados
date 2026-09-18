import { vi } from 'vitest'

/**
 * Sustituye `fetch` para probar una página pública compuesta por bloques sin
 * que su documento se meta en medio.
 *
 * Esas páginas piden primero su documento (`/contenido/<slug>`) y, dentro de
 * él, cada bloque de listado pide sus noticias, actos o publicaciones. Los
 * tests de estas pantallas son anteriores a los bloques y hablan de lo segundo:
 * miran `mock.calls[0]` esperando la petición del listado. Aquí el documento
 * responde 404 —la página cae a su contenido de partida, que es lo que pintaba
 * antes— y el simulado de cada test solo ve, y solo registra, el resto.
 */
export function stubFetchPublico(simulado: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', (url: RequestInfo | URL, init?: RequestInit) =>
    String(url).includes('/contenido/')
      ? Promise.resolve(new Response(JSON.stringify({ message: 'No encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
      : simulado(url, init))
}
