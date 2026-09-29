import { llamarApi, traerArchivo } from './cliente'
import type { TipoEvento } from './panel'

/**
 * «Datos e informes» y la Memoria del curso. La forma es la de
 * `backend-desamparados/src/domain/datos-areas.ts`: el servidor ya lo da dicho
 * en palabras (títulos, notas, etiquetas) para que la pantalla y los PDF digan
 * lo mismo. Aquí solo se pinta.
 */

export type ColorDato = 'oro' | 'rojo' | 'verde' | 'azul' | 'gris' | `tipo:${TipoEvento}`
export type FormatoDato = 'numero' | 'euros'

export interface SerieDato { nombre: string; color: ColorDato; valores: number[] }

export type CuerpoGrafica =
  | { tipo: 'columnas'; etiquetas: string[]; series: SerieDato[]; formato: FormatoDato; destacar?: number }
  | { tipo: 'apiladas'; etiquetas: string[]; capas: SerieDato[]; hoy?: number }
  | { tipo: 'barras'; filas: { etiqueta: string; valores: number[]; nota: string }[]; colores: ColorDato[] }
  | { tipo: 'lista'; filas: { dia: string; hora: string | null; titulo: string; lugar: string | null; color: ColorDato; pasado: boolean }[] }

export interface GraficaDato {
  titulo: string
  resumen: string
  leyenda?: { texto: string; color: ColorDato }[]
  pie?: string
  vacio?: string
  cuerpo: CuerpoGrafica
}

export interface CifraDato {
  etiqueta: string
  valor: number
  formato: FormatoDato | 'decimal' | 'diferencia' | 'diferencia-euros'
  sufijo?: string
  nota: string
  tono?: 'bueno' | 'malo'
  grafica: GraficaDato
}

export type ClaveArea = 'hermanos' | 'dinero' | 'procesion' | 'inventario' | 'web' | 'agenda'

export interface AreaDato {
  clave: ClaveArea
  nombre: string
  informe: string
  alcance?: string
  cifras: CifraDato[]
}

export interface PeriodoDato {
  clave: string
  tipo: 'curso' | 'ejercicio'
  anio: number
  etiqueta: string
  desde: string
  hasta: string
  enCurso: boolean
  anioPasion: number
  anioRosario: number
  meses: string[]
}

export interface DatosResponse {
  generadoEn: string
  periodo: PeriodoDato
  periodos: { clave: string; etiqueta: string }[]
  areas: AreaDato[]
}

export const traerDatos = (periodo?: string) =>
  llamarApi<DatosResponse>(`/datos${periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''}`)

export const traerInforme = (area: ClaveArea, periodo: string) =>
  traerArchivo(`/datos/informe/${area}?periodo=${encodeURIComponent(periodo)}`)

// ---------------------------------------------------------------- la Memoria

export interface TextosMemoria {
  presentacion: string | null
  firmaPresentacion: string | null
  lugarFecha: string | null
  epilogo: string | null
  firmaEpilogo: string | null
  notaPatrimonio: string | null
  fechaCabildo: string | null
}
export type CampoMemoria = keyof TextosMemoria

export interface MemoriaResponse {
  curso: number
  etiqueta: string
  desde: string
  hasta: string
  textos: TextosMemoria
  faltan: ('presentacion' | 'epilogo')[]
  actualizada: string | null
}

export const traerMemoria = (curso: number) => llamarApi<MemoriaResponse>(`/datos/memoria/${curso}`)

export const guardarMemoria = (curso: number, cambios: Partial<TextosMemoria>) =>
  llamarApi<MemoriaResponse>(`/datos/memoria/${curso}`, { method: 'PUT', json: cambios })

export const traerMemoriaPdf = (curso: number, borrador: boolean) =>
  traerArchivo(`/datos/memoria/${curso}/pdf${borrador ? '?borrador=1' : ''}`)

/** Descarga un fichero ya traído, con el nombre que propuso el servidor. */
export function guardarEnDisco({ blob, nombre }: { blob: Blob; nombre: string | null }, porDefecto: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre ?? porDefecto
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
