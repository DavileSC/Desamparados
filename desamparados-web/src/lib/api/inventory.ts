import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface Enser { id: number; nombre: string; referencia: string | null; categoria: string | null; ubicacion: string | null; cantidadOptimo: number; cantidadBueno: number; cantidadReparar: number; cantidadTotal: number }
export interface Prenda { id: number; numero: string; tipo: 'TUNICA' | 'CAPIROTE' | 'FARAONA' | 'CAPA' | 'OTRO'; talla: string | null; estado: 'DISPONIBLE' | 'PRESTADA' | 'TALLER' | 'BAJA'; observaciones: string | null; hermano: { nombre: string; apellidos: string; numeroHermano: number | null } | null }

// Enseres y ropero son dos listados independientes de la misma pantalla: cada
// uno pide su propia página, y por eso reciben la suya en vez de compartirla.
export const getEnseres = (pagina: { pagina: number; porPagina: number }) =>
  apiFetch<RespuestaPaginada<Enser>>(`/inventario/enseres?${paramsPagina(pagina)}`)
export const getPrendas = (pagina: { pagina: number; porPagina: number }) =>
  apiFetch<RespuestaPaginada<Prenda>>(`/inventario/prendas?${paramsPagina(pagina)}`)
export const createEnser = (json: object) => apiFetch<Enser>('/inventario/enseres', { method: 'POST', json })
export const updateEnser = (id: number, json: object) => apiFetch<Enser>(`/inventario/enseres/${id}`, { method: 'PUT', json })
export const deleteEnser = (id: number) => apiFetch<{ message: string }>(`/inventario/enseres/${id}`, { method: 'DELETE' })
export const createPrenda = (json: object) => apiFetch<Prenda>('/inventario/prendas', { method: 'POST', json })
export const updatePrenda = (id: number, json: object) => apiFetch<Prenda>(`/inventario/prendas/${id}`, { method: 'PUT', json })
export const deletePrenda = (id: number) => apiFetch<{ message: string }>(`/inventario/prendas/${id}`, { method: 'DELETE' })
/** Se presta por número de hermano, no por el id interno de la base de datos (que nadie conoce). */
export const assignPrenda = (id: number, numeroHermano: number) => apiFetch<{ message: string }>(`/inventario/prendas/${id}/asignar`, { method: 'POST', json: { numeroHermano } })
export const returnPrenda = (id: number, necesitaLavado: boolean) => apiFetch<{ message: string }>(`/inventario/prendas/${id}/devolver`, { method: 'POST', json: { necesitaLavado } })
export const getEnser = (id: number) => apiFetch<Enser>(`/inventario/enseres/${id}`)

/**
 * Antes se buscaba con un `.find()` dentro del listado del ropero; con el
 * listado paginado, una prenda fuera del recorte era imposible de editar.
 */
export const getPrenda = (id: number) => apiFetch<Prenda>(`/inventario/prendas/${id}`)

/** Lo justo para confirmar un préstamo antes de hacerlo: «Nº 123 · Nombre Apellidos». */
export interface HermanoDelRopero { numeroHermano: number; nombre: string; apellidos: string }

/** El hermano activo con ese número; 404 si no hay ninguno. Solo para gestores del inventario. */
export const buscarHermanoPorNumero = (numeroHermano: number) =>
  apiFetch<HermanoDelRopero>(`/inventario/hermanos/${numeroHermano}`)
