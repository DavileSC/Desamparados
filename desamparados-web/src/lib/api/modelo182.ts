import { llamarApi, traerArchivo } from './cliente'

/** Los datos del declarante y de quien firma los certificados (ver `modelo-182.service.ts`). */
export interface ConfiguracionModelo182 {
  nif: string | null
  telefono: string
  contacto: string
  firmanteNombre: string
  firmanteCargo: string
  cuotas: boolean
}

export interface AportacionDeclarada {
  nif: string
  nombre: string
  centimos: number
  fecha: string
  concepto: string
}

export interface Declarado {
  nif: string
  nifRepresentante: string | null
  apellidosYNombre: string
  nombre: string
  email: string | null
  provincia: string
  provinciaSupuesta: boolean
  naturaleza: 'F' | 'J' | 'E'
  centimos: number
  porcentaje: number
  recurrente: boolean
  aportaciones: AportacionDeclarada[]
}

export interface ResumenModelo182 {
  ejercicio: number
  configuracion: ConfiguracionModelo182
  declarados: Declarado[]
  total: number
  excluidos: { nombre: string; centimos: number; motivo: string }[]
  anonimos: { cuantos: number; centimos: number }
  faltaParaElFichero: string[]
  /** Cuándo se mandaron por correo los certificados de este ejercicio, y a cuántos. */
  enviados: { el: string; cuantos: number } | null
}

export const resumenModelo182 = (ejercicio: number) => llamarApi<ResumenModelo182>(`/recibos/admin/modelo-182?ejercicio=${ejercicio}`)
export const guardarConfiguracionModelo182 = (c: ConfiguracionModelo182) =>
  llamarApi<ConfiguracionModelo182>('/recibos/admin/modelo-182/configuracion', { method: 'PUT', json: c })
export const traerFicheroModelo182 = (ejercicio: number, justificante: string) =>
  traerArchivo(`/recibos/admin/modelo-182/fichero?ejercicio=${ejercicio}&justificante=${encodeURIComponent(justificante)}`)
export const traerCertificados = (ejercicio: number, nif?: string) =>
  traerArchivo(`/recibos/admin/modelo-182/certificados?ejercicio=${ejercicio}${nif ? `&nif=${encodeURIComponent(nif)}` : ''}`)

export const enviarCertificados = (ejercicio: number) =>
  llamarApi<{ enviados: number; fallidos: number; sinCorreo: number; message: string }>(`/recibos/admin/modelo-182/enviar?ejercicio=${ejercicio}`, { method: 'POST' })

/** Los certificados del área de hermanos: los de su cuenta, por ejercicio cerrado. */
export interface MisCertificados {
  /** Si el Grupo ya puso su NIF: sin él, no se puede sacar ninguno. */
  disponibles: boolean
  certificados: { ejercicio: number; nif: string; nombre: string; centimos: number }[]
}

export const misCertificados = () => llamarApi<MisCertificados>('/recibos/mis-recibos/certificados')
export const traerMiCertificado = (ejercicio: number, nif: string) =>
  traerArchivo(`/recibos/mis-recibos/certificados/pdf?ejercicio=${ejercicio}&nif=${encodeURIComponent(nif)}`)

/** El justificante que se propone: 182, el ejercicio y un 1 al final (13 cifras). */
export const justificantePorDefecto = (ejercicio: number) => `182${ejercicio}000001`

export const euros182 = (centimos: number) => (centimos / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
