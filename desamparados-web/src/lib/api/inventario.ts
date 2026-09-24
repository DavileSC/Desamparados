import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface Enser { id: number; nombre: string; referencia: string | null; categoria: string | null; ubicacion: string | null; cantidadOptimo: number; cantidadBueno: number; cantidadReparar: number; cantidadTotal: number }
export interface Prenda { id: number; numero: string; tipo: 'TUNICA' | 'CAPIROTE' | 'FARAONA' | 'CAPA' | 'OTRO'; talla: string | null; estado: 'DISPONIBLE' | 'PRESTADA' | 'LAVADO' | 'TALLER' | 'BAJA'; observaciones: string | null; hermano: { nombre: string; apellidos: string; numeroHermano: number | null } | null }

// Enseres y ropero son dos listados independientes de la misma pantalla: cada
// uno pide su propia página, y por eso reciben la suya en vez de compartirla.
// Cada uno con sus filtros y su orden; vacío = sin filtrar.
export type FiltrosEnseres = { search?: string; categoria?: string; ubicacion?: string; necesitaReparacion?: 'true' | ''; orden?: string }
export type FiltrosPrendas = { q?: string; tipo?: Prenda['tipo'] | ''; estado?: Prenda['estado'] | ''; orden?: string }
export const listarEnseres = (pagina: { pagina: number; porPagina: number }, filtros: FiltrosEnseres = {}) =>
  llamarApi<RespuestaPaginada<Enser>>(`/inventario/enseres?${paramsPagina(pagina, filtros)}`)
export const listarPrendas = (pagina: { pagina: number; porPagina: number }, filtros: FiltrosPrendas = {}) =>
  llamarApi<RespuestaPaginada<Prenda>>(`/inventario/prendas?${paramsPagina(pagina, filtros)}`)
/** Las categorías y ubicaciones que ya tienen los enseres, para los desplegables del filtro. */
export const opcionesDeEnseres = () => llamarApi<{ categorias: string[]; ubicaciones: string[] }>('/inventario/enseres/opciones')
export const crearEnser = (json: object) => llamarApi<Enser>('/inventario/enseres', { method: 'POST', json })
export const actualizarEnser = (id: number, json: object) => llamarApi<Enser>(`/inventario/enseres/${id}`, { method: 'PUT', json })
export const eliminarEnser = (id: number) => llamarApi<{ message: string }>(`/inventario/enseres/${id}`, { method: 'DELETE' })
export const crearPrenda = (json: object) => llamarApi<Prenda>('/inventario/prendas', { method: 'POST', json })
export const actualizarPrenda = (id: number, json: object) => llamarApi<Prenda>(`/inventario/prendas/${id}`, { method: 'PUT', json })
export const eliminarPrenda = (id: number) => llamarApi<{ message: string }>(`/inventario/prendas/${id}`, { method: 'DELETE' })
/** Se presta por número de hermano, no por el id interno de la base de datos (que nadie conoce). */
export const asignarPrenda = (id: number, numeroHermano: number) => llamarApi<{ message: string }>(`/inventario/prendas/${id}/asignar`, { method: 'POST', json: { numeroHermano } })
/** La túnica va siempre al lavado; lo demás, disponible; lo roto (`rota`), al taller. */
export const devolverPrenda = (id: number, rota: boolean) => llamarApi<{ message: string; data: Prenda }>(`/inventario/prendas/${id}/devolver`, { method: 'POST', json: { rota } })
/** Las prendas del lavado que ya están limpias vuelven a estar disponibles; sin ids, todas. */
export const marcarLavadas = (ids?: number[]) => llamarApi<{ ids: number[]; lavadas: number }>('/inventario/prendas/lavadas', { method: 'POST', json: ids ? { ids } : {} })

/** Los cíngulos no van numerados: se cuentan. */
export interface RecuentoDeCingulos { total: number; prestados: number; enElRopero: number; debidos: number }
export const recuentoDeCingulos = () => llamarApi<RecuentoDeCingulos>('/inventario/cingulos')
export const cambiarTotalDeCingulos = (total: number) => llamarApi<RecuentoDeCingulos>('/inventario/cingulos', { method: 'PUT', json: { total } })
export const traerEnser = (id: number) => llamarApi<Enser>(`/inventario/enseres/${id}`)

/**
 * Antes se buscaba con un `.find()` dentro del listado del ropero; con el
 * listado paginado, una prenda fuera del recorte era imposible de editar.
 */
export const traerPrenda = (id: number) => llamarApi<Prenda>(`/inventario/prendas/${id}`)

/** Lo justo para confirmar un préstamo antes de hacerlo: «Nº 123 · Nombre Apellidos». */
export interface HermanoDelRopero { numeroHermano: number; nombre: string; apellidos: string }

/** El hermano activo con ese número; 404 si no hay ninguno. Solo para gestores del inventario. */
export const buscarHermanoPorNumero = (numeroHermano: number) =>
  llamarApi<HermanoDelRopero>(`/inventario/hermanos/${numeroHermano}`)
