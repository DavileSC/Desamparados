import { euros } from '../../../lib/euros'

/**
 * Fechas de una salida: «AAAA-MM-DD», ya calculada por el servidor
 * (`fechaDelAnio`). Se construye con año/mes/día sueltos y no con
 * `new Date('AAAA-MM-DD')`: esa forma la interpreta como medianoche UTC, y
 * para calcular el día de la semana en una zona por delante de UTC (Madrid)
 * puede devolver el día siguiente al que de verdad marca la cadena.
 */
function fechaLocal(dia: string): Date {
  const [anio, mes, diaDelMes] = dia.split('-').map(Number)
  return new Date(anio, mes - 1, diaDelMes)
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** «28 de marzo de 2026». */
function fechaLarga(dia: string): string {
  const f = fechaLocal(dia)
  return `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`
}

/** «sábado 28 de marzo de 2026», con el día de la semana delante. */
export function fechaConDia(dia: string): string {
  const diaSemana = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(fechaLocal(dia))
  return `${diaSemana} ${fechaLarga(dia)}`
}

/** «1.250,00 €»: el de toda la web. */


interface SalidaResumen {
  fecha: 'PASCUA' | 'MANUAL'
  fechaDelAnio: string | null
  cobro: 'CUOTA' | 'DONATIVO'
  importeCuota: number
}

/** «Por la Pascua: 28 de marzo de 2026» o «A mano: sin fecha». */
export const resumenFecha = (s: SalidaResumen) => {
  const etiqueta = s.fecha === 'PASCUA' ? 'Por la Pascua' : 'A mano'
  return `${etiqueta}: ${s.fechaDelAnio ? fechaLarga(s.fechaDelAnio) : 'sin fecha'}`
}

/** «Cuota de 25,00 €» o «Donativo». */
export const resumenCobro = (s: SalidaResumen) => (s.cobro === 'DONATIVO' ? 'Donativo' : `Cuota de ${euros(s.importeCuota)}`)
