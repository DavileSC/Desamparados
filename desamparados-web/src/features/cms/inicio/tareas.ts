import type { PanelResponse } from '../../../lib/api/panel'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
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
}

const CONTENIDO = ['ADMIN', 'REDES', 'HERMANO_MAYOR']
const SECRETARIA = ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR']
const TESORERIA = ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR']

export function tareasDelDia(panel: PanelResponse): Tarea[] {
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
    })
  }

  return tareas
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
