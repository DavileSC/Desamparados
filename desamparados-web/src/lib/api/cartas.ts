import { llamarApi, traerArchivo } from './cliente'
import HOJAS from '../../../../shared/formatos-de-etiquetas.json'

/** Lo que se imprime: el asunto, el texto con sus campos y la firma. */
interface TextoDeCarta {
  asunto: string
  cuerpo: string
  firmaCargo: string
  firmaNombre: string | null
}

/** Una carta guardada: su nombre para encontrarla y a quién va (los filtros del censo, como la URL). */
export interface Carta extends TextoDeCarta {
  id: number
  nombre: string
  consulta: string
  updatedAt: string
}

export type DatosDeCarta = Omit<Carta, 'id' | 'updatedAt'>

/** Los campos que se rellenan con los datos de cada hermano. */
export const CAMPOS_DE_CARTA = [
  { campo: 'saludo', ayuda: 'Estimado, Estimada o Estimado/a, según la ficha' },
  { campo: 'tratamiento', ayuda: 'El de la ficha, o D. / Dña.' },
  { campo: 'nombre', ayuda: 'Su nombre' },
  { campo: 'apellidos', ayuda: 'Sus apellidos' },
  { campo: 'numero', ayuda: 'Su número de hermano' },
] as const

export const cartas = () => llamarApi<Carta[]>('/cartas')
export const crearCarta = (d: DatosDeCarta) => llamarApi<Carta>('/cartas', { method: 'POST', json: d })
export const guardarCarta = (id: number, d: DatosDeCarta) => llamarApi<Carta>(`/cartas/${id}`, { method: 'PUT', json: d })
export const borrarCarta = (id: number) => llamarApi<{ message: string }>(`/cartas/${id}`, { method: 'DELETE' })

/** Cuántas cartas saldrían con esos filtros, cuántas sin dirección para el sobre y en cuántas casas viven los demás. */
export const destinatariosDeCarta = (consulta: string) =>
  llamarApi<{ total: number; demasiados: boolean; sinDireccion: number; domicilios: number }>(`/cartas/destinatarios?consulta=${encodeURIComponent(consulta)}`)

/** El PDF: la de prueba (solo la del primero) o todas. */
export const pdfDeCartas = (texto: TextoDeCarta, consulta: string, prueba: boolean) =>
  traerArchivo('/cartas/pdf', { ...texto, consulta, prueba })

/** Las hojas de etiquetas que se pueden elegir, las mismas que dibuja el servidor. */
export const FORMATOS_DE_ETIQUETAS = Object.entries(HOJAS.formatos).map(([clave, f]) => ({ clave, nombre: f.nombre, porHoja: f.columnas * f.filas }))

export interface PedidoDeEtiquetas {
  consulta: string
  formato: string
  /** Las que ya se gastaron de una hoja empezada: se empieza en la siguiente. */
  saltar: number
  porDomicilio: boolean
}

export const pdfDeEtiquetas = (p: PedidoDeEtiquetas) => traerArchivo('/cartas/etiquetas', p)
