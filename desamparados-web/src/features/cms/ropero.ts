import type { Prenda } from '../../lib/api/inventory'

/** Cómo se lee cada estado de una prenda en el CMS (en la base de datos van en mayúsculas). */
export const ETIQUETA_ESTADO: Record<Prenda['estado'], string> = {
  DISPONIBLE: 'Disponible',
  PRESTADA: 'Prestada',
  TALLER: 'En taller',
  BAJA: 'De baja',
}

/**
 * Los estados que se eligen a mano, al dar de alta o al editar. PRESTADA no está:
 * la ponen «Prestar» y «Devolver», que guardan también quién tiene la prenda.
 * Elegida a mano quedaba prestada a nadie, o disponible con un hermano apuntado.
 */
export const ESTADOS_ELEGIBLES: Prenda['estado'][] = ['DISPONIBLE', 'TALLER', 'BAJA']

/** Las unidades de un lote son enteras: con decimales el servidor las rechaza. Vacío cuenta como 0. */
export const esCantidadValida = (valor: string) => /^\d*$/.test(valor.trim())

export const AVISO_CANTIDADES = 'Las cantidades tienen que ser números enteros, sin decimales.'
