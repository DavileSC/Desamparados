import { llamarApi, traerArchivo } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface Enser {
  id: number; nombre: string; referencia: string | null; categoria: string | null; ubicacion: string | null
  cantidadOptimo: number; cantidadBueno: number; cantidadReparar: number; cantidadTotal: number
  // La ficha de patrimonio (la tasación llega como texto decimal de Prisma).
  imagenUrl?: string | null; descripcion?: string | null; autor?: string | null; epoca?: string | null
  materiales?: string | null; dimensiones?: string | null; conservacion?: string | null
  fotos?: { url: string; pie: string }[] | null; valorTasacion?: string | number | null; fechaTasacion?: string | null; tasadoPor?: string | null
}
export interface Prenda { id: number; numero: string; tipo: 'TUNICA' | 'CAPIROTE' | 'FARAONA' | 'CAPA' | 'OTRO'; talla: string | null; estado: 'DISPONIBLE' | 'PRESTADA' | 'LAVADO' | 'TALLER' | 'BAJA'; observaciones: string | null; hermano: { nombre: string; apellidos: string; numeroHermano: number | null } | null }

// Enseres y ropero son dos listados independientes de la misma pantalla: cada
// uno pide su propia página, y por eso reciben la suya en vez de compartirla.
// Cada uno con sus filtros y su orden; vacío = sin filtrar.
type FiltrosEnseres = { search?: string; categoria?: string; ubicacion?: string; necesitaReparacion?: 'true' | ''; orden?: string }
export type FiltrosPrendas = { q?: string; tipo?: Prenda['tipo'] | ''; estado?: Prenda['estado'] | ''; orden?: string }
export const listarEnseres = (pagina: { pagina: number; porPagina: number }, filtros: FiltrosEnseres = {}) =>
  llamarApi<RespuestaPaginada<Enser>>(`/inventario/enseres?${paramsPagina(pagina, filtros)}`)
// El ropero es de Procesión y vive en /api/ropero (ver backend ropero.routes.ts).
export const listarPrendas = (pagina: { pagina: number; porPagina: number }, filtros: FiltrosPrendas = {}) =>
  llamarApi<RespuestaPaginada<Prenda>>(`/ropero/prendas?${paramsPagina(pagina, filtros)}`)
/** Las categorías y ubicaciones que ya tienen los enseres, para los desplegables del filtro. */
export const opcionesDeEnseres = () => llamarApi<{ categorias: string[]; ubicaciones: string[] }>('/inventario/enseres/opciones')
export const crearEnser = (json: object) => llamarApi<Enser>('/inventario/enseres', { method: 'POST', json })
export const actualizarEnser = (id: number, json: object) => llamarApi<Enser>(`/inventario/enseres/${id}`, { method: 'PUT', json })
export const eliminarEnser = (id: number) => llamarApi<{ message: string }>(`/inventario/enseres/${id}`, { method: 'DELETE' })
export const crearPrenda = (json: object) => llamarApi<Prenda>('/ropero/prendas', { method: 'POST', json })
export const actualizarPrenda = (id: number, json: object) => llamarApi<Prenda>(`/ropero/prendas/${id}`, { method: 'PUT', json })
export const eliminarPrenda = (id: number) => llamarApi<{ message: string }>(`/ropero/prendas/${id}`, { method: 'DELETE' })
/** Se presta a la ficha que se eligió buscando por nombre y apellidos (ver `buscarHermanosDelRopero`). */
export const asignarPrenda = (id: number, hermanoId: number) => llamarApi<{ message: string }>(`/ropero/prendas/${id}/asignar`, { method: 'POST', json: { hermanoId } })
/** La túnica va siempre al lavado; lo demás, disponible; lo roto (`rota`), al taller. */
export const devolverPrenda = (id: number, rota: boolean) => llamarApi<{ message: string; data: Prenda }>(`/ropero/prendas/${id}/devolver`, { method: 'POST', json: { rota } })
/** Las prendas del lavado que ya están limpias vuelven a estar disponibles; sin ids, todas. */
export const marcarLavadas = (ids?: number[]) => llamarApi<{ ids: number[]; lavadas: number }>('/ropero/prendas/lavadas', { method: 'POST', json: ids ? { ids } : {} })

/** Los cíngulos no van numerados: se cuentan. */
export interface RecuentoDeCingulos { total: number; prestados: number; enElRopero: number; debidos: number }
export const recuentoDeCingulos = () => llamarApi<RecuentoDeCingulos>('/ropero/cingulos')
export const cambiarTotalDeCingulos = (total: number) => llamarApi<RecuentoDeCingulos>('/ropero/cingulos', { method: 'PUT', json: { total } })
export const traerEnser = (id: number) => llamarApi<Enser>(`/inventario/enseres/${id}`)
/** La ficha de patrimonio en PDF, para el seguro, el Obispado o una restauración. */
export const traerFichaEnser = (id: number) => traerArchivo(`/inventario/enseres/${id}/ficha`)

/**
 * Antes se buscaba con un `.find()` dentro del listado del ropero; con el
 * listado paginado, una prenda fuera del recorte era imposible de editar.
 */
export const traerPrenda = (id: number) => llamarApi<Prenda>(`/ropero/prendas/${id}`)

/**
 * Un hermano de alta, tal como sale al buscarlo para prestarle algo: lo justo
 * para no confundir a dos que se llaman igual (número, edad, quién lleva su
 * cuenta si no es suya) y lo que ya tiene del ropero.
 */
export interface HermanoDelRopero {
  id: number
  numeroHermano: number | null
  nombre: string
  apellidos: string
  fechaNacimiento: string
  puesto: string | null
  /** Quien lleva su cuenta si no es la suya (un padre, una tía, el padrino). */
  gestor: string | null
  prendas: { tipo: Prenda['tipo']; numero: string; talla: string | null }[]
}

/** Por nombre y apellidos, en cualquier orden; con menos de dos letras, nadie. */
export const buscarHermanosDelRopero = (q: string) =>
  llamarApi<HermanoDelRopero[]>(`/ropero/hermanos?q=${encodeURIComponent(q)}`)

/** Cuántas prendas hay de cada tipo en cada estado: las cabeceras de los grupos del ropero. */
export interface RecuentoDeTipo { tipo: Prenda['tipo']; total: number; estados: Partial<Record<Prenda['estado'], number>> }
export const recuentoDelRopero = () => llamarApi<RecuentoDeTipo[]>('/ropero/recuento')
