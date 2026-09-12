/**
 * Cómo se cuenta una acción de la auditoría sin nombrar lo que se tocó. El
 * contrato de `actividad.registro` solo trae la acción y el tipo de entidad, a
 * propósito: el Inicio lo ve toda la junta y no puede enseñar ni personas ni
 * borradores sin publicar.
 */
const ACCIONES: Record<string, string> = {
  NOTICIA_CREAR: 'creó una noticia',
  NOTICIA_ACTUALIZAR: 'editó una noticia',
  NOTICIA_ELIMINAR: 'borró una noticia',
  PUBLICACION_CREAR: 'subió una publicación',
  PUBLICACION_ACTUALIZAR: 'editó una publicación',
  PUBLICACION_ELIMINAR: 'borró una publicación',
  PAGINA_GUARDAR: 'creó una página',
  PAGINA_ACTUALIZAR: 'editó una página',
  PAGINA_ELIMINAR: 'borró una página',
  PORTADA_ACTUALIZAR: 'cambió la portada',
  EVENTO_CREAR: 'añadió un acto a la agenda',
  EVENTO_ACTUALIZAR: 'cambió un acto de la agenda',
  EVENTO_ELIMINAR: 'quitó un acto de la agenda',
}

export function describirAccion(accion: string, _entityType: string | null): string {
  return ACCIONES[accion] ?? 'hizo un cambio'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const hora = (f: Date) => `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`
const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** «Hoy 10:05», «Ayer 19:12» o «9 sep»: lo reciente con hora, lo viejo con fecha. */
export function cuandoFue(iso: string, ahora: Date): string {
  const fecha = new Date(iso)
  if (mismoDia(fecha, ahora)) return `Hoy ${hora(fecha)}`
  const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1)
  if (mismoDia(fecha, ayer)) return `Ayer ${hora(fecha)}`
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`
}
