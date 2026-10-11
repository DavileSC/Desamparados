import type { AvisoJunta, PanelResponse } from '../../../lib/api/panel'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { CLAVES_MODULO, cumple, type Modulo } from '../../../domain/modulos'
import { contar } from './plural'

/**
 * «Para hoy»: lo que hay que hacer, sacado de lo que ya devuelve /api/panel.
 *
 * Vive aparte del JSX porque es la única parte del Inicio con reglas de verdad
 * —qué es urgente, quién lo lleva, quién ve el botón— y así se prueba sola.
 */
export type Prioridad = 'urgente' | 'pendiente' | 'programado'

const ETIQUETA: Record<Prioridad, string> = {
  urgente: 'Urgente',
  pendiente: 'Pendiente',
  programado: 'Programado',
}

export interface Tarea {
  clave: string
  prioridad: Prioridad
  /** El estado en palabras: el color nunca va solo. */
  etiqueta: string
  titulo: string
  detalle: string
  /** Cargo que lo lleva, tal y como se enseña. */
  cargo: string
  /** Roles que pueden actuar sobre él (los mismos que la guarda de su pantalla). */
  roles: string[]
  /** `null` cuando todavía no hay pantalla a la que ir. */
  accion: { texto: string; href: string } | null
  /** Solo en los avisos de la junta: se dan por hecho desde el propio Inicio. */
  aviso?: { id: number; creadoPorId: number | null }
  /** La ficha del censo de la que trata, si trata de una: el aviso enlaza a ella. */
  hermanoId?: number
  /**
   * El texto se lee entero, sin recortar en una línea: el de «no es de mi
   * familia» lo escribe el servidor con el número y los dos nombres, y
   * cortado no decía de qué ficha se trataba.
   */
  entero?: boolean
  /** De qué módulo es el asunto: apagado, no se enseña. Los avisos de la junta son del núcleo. */
  modulo: Modulo
}

const JUNTA = ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA']
const CONTENIDO = ['ADMIN', 'REDES', 'HERMANO_MAYOR']
const SECRETARIA = ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR']
const TESORERIA = ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR']

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** Hoy en España, «AAAA-MM-DD»: la fecha límite de un aviso se compara con esto. */
const hoyEnMadrid = (hoy: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(hoy)
const diaCorto = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`
const DIA_EN_MS = 24 * 60 * 60 * 1000
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DIA_EN_MS)

/**
 * Un aviso de la junta como asunto: urgente si se marcó así o si ya pasó su
 * fecha sin hacerse. Lo lleva su cargo (o toda la junta); el Hermano Mayor y
 * Administración, como en todo, también.
 */
export function tareaDeAviso(aviso: AvisoJunta, hoy: Date = new Date()): Tarea {
  const dia = hoyEnMadrid(hoy)
  const vencido = aviso.hasta !== null && aviso.hasta < dia
  const prioridad: Prioridad = aviso.urgente || vencido ? 'urgente' : 'pendiente'
  let cuando = ''
  if (aviso.hasta) {
    const faltan = diasEntre(dia, aviso.hasta)
    cuando = faltan < -1 ? ` · vencía el ${diaCorto(aviso.hasta)}` : faltan === -1 ? ' · vencía ayer' : faltan === 0 ? ' · vence hoy' : faltan === 1 ? ' · hasta mañana' : ` · hasta el ${diaCorto(aviso.hasta)}`
  }
  const para = aviso.para ? `para ${NOMBRE_CARGO[aviso.para]}` : 'para toda la junta'
  return {
    clave: `aviso-${aviso.id}`,
    prioridad,
    etiqueta: ETIQUETA[prioridad],
    titulo: aviso.texto,
    detalle: `${para} · de ${aviso.creadorRol === 'USER' ? 'un hermano' : NOMBRE_CARGO[aviso.creadorRol]}${cuando}`,
    cargo: aviso.para ? NOMBRE_CARGO[aviso.para] : 'Toda la junta',
    roles: aviso.para ? [aviso.para, 'ADMIN', 'HERMANO_MAYOR'] : JUNTA,
    accion: null,
    aviso: { id: aviso.id, creadoPorId: aviso.creadoPorId },
    ...(aviso.hermanoId !== null && { hermanoId: aviso.hermanoId }),
    entero: aviso.creadorRol === 'USER',
    modulo: 'nucleo',
  }
}

const ORDEN: Record<Prioridad, number> = { urgente: 0, pendiente: 1, programado: 2 }

export function tareasDelDia(panel: PanelResponse, hoy: Date = new Date(), activos: ReadonlySet<string> = new Set(CLAVES_MODULO)): Tarea[] {
  const tareas: Tarea[] = []

  // Los ya reemitidos no piden nada: su recibo nuevo sigue su curso.
  const devueltos = panel.dinero.devueltosPendientes?.total ?? 0
  if (devueltos > 0) {
    tareas.push({
      clave: 'recibos-devueltos',
      prioridad: 'urgente',
      etiqueta: ETIQUETA.urgente,
      titulo: `${contar(devueltos, 'recibo devuelto', 'recibos devueltos')} sin reemitir`,
      detalle: `Tesorería · ejercicio ${panel.ejercicio.anio}`,
      cargo: NOMBRE_CARGO.TESORERIA,
      roles: TESORERIA,
      accion: { texto: 'Revisar', href: '/cms/tesoreria' },
      modulo: 'nucleo',
    })
  }

  const borradores = panel.actividad.noticias.borradores
  if (borradores > 0) {
    tareas.push({
      clave: 'noticias-borrador',
      prioridad: 'pendiente',
      etiqueta: ETIQUETA.pendiente,
      titulo: contar(borradores, 'noticia en borrador', 'noticias en borrador'),
      detalle: 'Noticias · sin publicar',
      cargo: NOMBRE_CARGO.REDES,
      roles: CONTENIDO,
      accion: { texto: 'Publicar', href: '/cms/noticias' },
      modulo: 'noticias',
    })
  }

  const sinNumero = panel.censo.sinNumeroHermano
  if (sinNumero > 0) {
    tareas.push({
      clave: 'hermanos-sin-numero',
      prioridad: 'pendiente',
      etiqueta: ETIQUETA.pendiente,
      titulo: `${contar(sinNumero, 'hermano', 'hermanos')} sin número de hermano`,
      detalle: 'Hermanos · altas recientes',
      cargo: NOMBRE_CARGO.SECRETARIA,
      roles: SECRETARIA,
      accion: { texto: 'Asignar', href: '/cms/hermanos' },
      modulo: 'nucleo',
    })
  }

  const { citasReservadas, turnosProximos, capacidadEstimada } = panel.actividad.reparto
  if (citasReservadas > 0 || turnosProximos > 0) {
    tareas.push({
      clave: 'citas-reparto',
      prioridad: 'programado',
      etiqueta: ETIQUETA.programado,
      titulo: contar(citasReservadas, 'cita de reparto', 'citas de reparto'),
      detalle: `Reparto · ${contar(turnosProximos, 'turno próximo', 'turnos próximos')}, capacidad para ${capacidadEstimada}`,
      cargo: NOMBRE_CARGO.SECRETARIA,
      roles: SECRETARIA,
      // El CMS todavía no tiene pantalla de turnos de reparto: sin sitio al que
      // ir, el asunto informa y no ofrece botón a nadie.
      accion: null,
      modulo: 'procesion',
    })
  }

  // Los avisos de la junta, entre los demás por su prioridad: lo urgente arriba.
  // `sort` es estable, así que dentro de cada prioridad no cambia el orden.
  for (const aviso of panel.avisos ?? []) tareas.push(tareaDeAviso(aviso, hoy))
  return tareas.filter((t) => cumple(t.modulo, activos)).sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad])
}

/**
 * Lo tuyo, con botón; lo del resto de la junta, con «Lo lleva X». ADMIN y
 * HERMANO_MAYOR están en las tres listas de roles, así que lo llevan todo.
 */
export function repartirTareas(tareas: Tarea[], role?: string) {
  const tuyas = tareas.filter((t) => role !== undefined && t.roles.includes(role))
  const deLaJunta = tareas.filter((t) => !tuyas.includes(t))
  return { tuyas, deLaJunta }
}
