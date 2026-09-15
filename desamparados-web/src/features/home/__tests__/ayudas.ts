import { vi } from 'vitest'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import type { TextosPortada } from '../../../lib/api/portada'

export const textosDePrueba = () => structuredClone(POR_DEFECTO.portada) as TextosPortada

const json = (cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

/**
 * Simula la API de la portada. `/portada` devuelve los textos que se le pasen;
 * cualquier otra ruta, una lista vacía con su `meta`, que es lo que esperan los
 * bloques que además piden noticias, agenda o publicaciones.
 *
 * Una instancia de `Response` NUEVA por llamada: `apiFetch` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda.
 */
export function responderPortada(textos: TextosPortada, imagenes: unknown[] = []) {
  const simulado = vi.fn().mockImplementation((url: unknown) =>
    Promise.resolve(String(url).includes('/portada')
      ? json({ imagenes, textos })
      : json({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })))
  vi.stubGlobal('fetch', simulado)
  return simulado
}
