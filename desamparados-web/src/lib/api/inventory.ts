import { apiFetch } from './client'

export interface Enser { id: number; nombre: string; referencia: string | null; categoria: string | null; ubicacion: string | null; cantidadOptimo: number; cantidadBueno: number; cantidadReparar: number; cantidadTotal: number }
export interface Prenda { id: number; numero: string; tipo: 'TUNICA' | 'CAPIROTE' | 'FARAONA' | 'CAPA' | 'OTRO'; talla: string | null; estado: 'DISPONIBLE' | 'PRESTADA' | 'TALLER' | 'BAJA'; observaciones: string | null; hermano: { nombre: string; apellidos: string; numeroHermano: number | null } | null }

export const getEnseres = () => apiFetch<Enser[]>('/inventario/enseres')
export const getPrendas = () => apiFetch<Prenda[]>('/inventario/prendas')
export const createEnser = (json: object) => apiFetch<Enser>('/inventario/enseres', { method: 'POST', json })
export const updateEnser = (id: number, json: object) => apiFetch<Enser>(`/inventario/enseres/${id}`, { method: 'PUT', json })
export const deleteEnser = (id: number) => apiFetch<{ message: string }>(`/inventario/enseres/${id}`, { method: 'DELETE' })
export const createPrenda = (json: object) => apiFetch<Prenda>('/inventario/prendas', { method: 'POST', json })
export const updatePrenda = (id: number, json: object) => apiFetch<Prenda>(`/inventario/prendas/${id}`, { method: 'PUT', json })
export const deletePrenda = (id: number) => apiFetch<{ message: string }>(`/inventario/prendas/${id}`, { method: 'DELETE' })
export const assignPrenda = (id: number, hermanoId: number) => apiFetch<{ message: string }>(`/inventario/prendas/${id}/asignar`, { method: 'POST', json: { hermanoId } })
export const returnPrenda = (id: number, necesitaLavado: boolean) => apiFetch<{ message: string }>(`/inventario/prendas/${id}/devolver`, { method: 'POST', json: { necesitaLavado } })
export const getEnser = (id: number) => apiFetch<Enser>(`/inventario/enseres/${id}`)

/** El servidor no publica la prenda suelta; se busca en el listado del ropero. */
export const getPrenda = async (id: number) => {
  const prenda = (await getPrendas()).find((item) => item.id === id)
  if (!prenda) throw new Error('No se ha encontrado la prenda.')
  return prenda
}
