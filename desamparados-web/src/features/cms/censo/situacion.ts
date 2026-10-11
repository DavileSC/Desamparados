import type { TonoPildora } from '../listados/tonos'

/**
 * En qué punto del censo está una ficha. Las tres se tratan distinto: solo una
 * activa se da de baja, solo una de baja se reactiva, y una pendiente se
 * aprueba o se rechaza desde Solicitudes.
 */
type Situacion = 'activo' | 'baja' | 'pendiente'

export const situacionDe = (f: { activo: boolean; fechaBaja: string | null }): Situacion =>
  (f.activo ? 'activo' : f.fechaBaja ? 'baja' : 'pendiente')

export const SITUACION: Record<Situacion, { texto: string; tono: TonoPildora }> = {
  activo: { texto: 'Activo', tono: 'ok' },
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  baja: { texto: 'De baja', tono: 'neutro' },
}

/** «BS» de «Benítez Salas, Antonio»: primera letra de los apellidos y del nombre. */
export const iniciales = (apellidos: string, nombre: string) =>
  `${apellidos.trim()[0] ?? ''}${nombre.trim()[0] ?? ''}`.toUpperCase()
