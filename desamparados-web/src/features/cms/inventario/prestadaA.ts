import type { Prenda } from '../../../lib/api/inventario'

/** Quien la tiene, como se lee en el ropero: «Apellidos, Nombre (n.º 23)». */
export const prestadaA = (p: Prenda) => (p.hermano
  ? `${p.hermano.apellidos}, ${p.hermano.nombre}${p.hermano.numeroHermano ? ` (n.º ${p.hermano.numeroHermano})` : ''}`
  : null)
