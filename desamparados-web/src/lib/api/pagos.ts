import { llamarApi } from './cliente'
import type { DatosFiscales } from '../certificado'
import type { EstadoDelPago, InicioDePago, MetodoEnLinea } from './procesion'

/** Con qué se paga en línea y si es de pruebas; null si no hay pago en línea. Lo ve cualquiera. */
export function metodosDePago() {
  return llamarApi<{ pago: { metodos: MetodoEnLinea[]; pruebas: boolean } | null }>('/pagos/metodos')
}

export interface Donativo {
  /** El slug de la página desde la que se dona: su bloque dice qué se admite. */
  pagina: string
  /** En euros, con hasta dos decimales. */
  importe: number
  destino?: string
  nombre?: string
  email?: string
  metodo: MetodoEnLinea
  /** Si quiere el certificado para la renta. */
  fiscal?: DatosFiscales | null
}

/** Empezar un donativo, sin cuenta: con el banco vuelve el formulario firmado; simulado, ya está hecho. */
export function donar(donativo: Donativo) {
  return llamarApi<InicioDePago>('/pagos/donativo', { method: 'POST', json: donativo })
}

/** Cómo va un donativo a la vuelta del banco: solo su estado y su importe. */
export function estadoDelDonativo(pedido: string) {
  return llamarApi<{ estado: EstadoDelPago; importe: number }>(`/pagos/donativo/${encodeURIComponent(pedido)}`)
}
