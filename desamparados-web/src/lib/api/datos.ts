import { llamarApi, traerArchivo } from './cliente'
import type { TipoEvento } from './panel'

/**
 * «Datos e informes» y el Informe anual. La forma es la de
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

/** Un año natural, del 1 de enero al 31 de diciembre: el Grupo no lleva cursos. */
export interface PeriodoDato {
  clave: string
  anio: number
  etiqueta: string
  desde: string
  hasta: string
  /** Si es el año de hoy: las cifras son «hasta hoy». */
  enMarcha: boolean
  /** Hasta qué día del año anterior se compara, si este va en marcha. */
  comparaHasta: string | null
  meses: string[]
}

export interface DatosResponse {
  generadoEn: string
  periodo: PeriodoDato
  periodos: { clave: string; etiqueta: string }[]
  areas: AreaDato[]
}

export const traerDatos = (anio?: string) =>
  llamarApi<DatosResponse>(`/datos${anio ? `?anio=${encodeURIComponent(anio)}` : ''}`)

export const traerInforme = (area: ClaveArea, anio: string) =>
  traerArchivo(`/datos/informe/${area}?anio=${encodeURIComponent(anio)}`)

// ---------------------------------------------------------------- el Informe anual

export interface TextosInforme {
  presentacion: string | null
  firmaPresentacion: string | null
  lugarFecha: string | null
  epilogo: string | null
  firmaEpilogo: string | null
  notaPatrimonio: string | null
  fechaCabildo: string | null
}
export type CampoInforme = keyof TextosInforme

export interface InformeAnualResponse {
  anio: number
  desde: string
  hasta: string
  textos: TextosInforme
  faltan: ('presentacion' | 'epilogo')[]
  actualizada: string | null
}

export const traerInformeAnual = (anio: number) => llamarApi<InformeAnualResponse>(`/datos/informe-anual/${anio}`)

export const guardarInformeAnual = (anio: number, cambios: Partial<TextosInforme>) =>
  llamarApi<InformeAnualResponse>(`/datos/informe-anual/${anio}`, { method: 'PUT', json: cambios })

export const traerInformeAnualPdf = (anio: number, borrador: boolean) =>
  traerArchivo(`/datos/informe-anual/${anio}/pdf${borrador ? '?borrador=1' : ''}`)

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
