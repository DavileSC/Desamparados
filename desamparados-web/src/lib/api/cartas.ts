import { llamarApi, traerArchivo } from './cliente'

/** Lo que se imprime: el asunto, el texto con sus campos y la firma. */
export interface TextoDeCarta {
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

/** Cuántas cartas saldrían con esos filtros, y cuántas sin dirección para el sobre. */
export const destinatariosDeCarta = (consulta: string) =>
  llamarApi<{ total: number; demasiados: boolean; sinDireccion: number }>(`/cartas/destinatarios?consulta=${encodeURIComponent(consulta)}`)

/** El PDF: la de prueba (solo la del primero) o todas. */
export const pdfDeCartas = (texto: TextoDeCarta, consulta: string, prueba: boolean) =>
  traerArchivo('/cartas/pdf', { ...texto, consulta, prueba })
