import { vi } from 'vitest'
import POR_DEFECTO from '../../../shared/contenido-por-defecto.json'

/**
 * Sustituye `fetch` para probar una página pública compuesta por bloques sin
 * que su documento se meta en medio.
 *
 * Esas páginas piden primero su documento (`/contenido/<slug>`) y, dentro de
 * él, cada bloque de listado pide sus noticias, actos o publicaciones. Los
 * tests de estas pantallas son anteriores a los bloques y hablan de lo segundo:
 * miran `mock.calls[0]` esperando la petición del listado. Aquí el documento
 * se sirve tal cual es el de partida —lo que el servidor tiene mientras nadie
 * lo edita— y el simulado de cada test solo ve, y solo registra, el resto.
 */
export function stubFetchPublico(simulado: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', (url: RequestInfo | URL, init?: RequestInit) => {
    const slug = /\/contenido\/([\w-]+)/.exec(String(url))?.[1]
    if (!slug) return simulado(url, init)
    const documento = (POR_DEFECTO as Record<string, unknown>)[slug]
    return Promise.resolve(documento
      ? new Response(JSON.stringify(documento), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ message: 'No encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
  })
}
