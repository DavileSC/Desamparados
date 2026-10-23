import type { EstadoDeLaMarca } from '../../../lib/api/corporacion'

/** Lo que la vista previa del asistente necesita para pintar la web como quedará. */
export interface VistaDeLaMarca {
  nombre: string
  nombreCorto: string
  localidad: string
  colorPrincipal: string | null
  colorAcento: string | null
  escudo: string | null
  escudoSobreClaro: string | null
  icono: string | null
}

/** La vista de lo guardado o, si se está escribiendo, de lo escrito. */
export function vistaDeLaMarca(estado: EstadoDeLaMarca, escrito?: Pick<VistaDeLaMarca, 'nombre' | 'nombreCorto' | 'localidad' | 'colorPrincipal' | 'colorAcento'>): VistaDeLaMarca {
  return {
    nombre: escrito?.nombre ?? estado.identidad.nombre,
    nombreCorto: escrito?.nombreCorto ?? estado.identidad.nombreCorto,
    localidad: escrito?.localidad ?? estado.identidad.localidad,
    colorPrincipal: escrito ? escrito.colorPrincipal : estado.colores.colorPrincipal,
    colorAcento: escrito ? escrito.colorAcento : estado.colores.colorAcento,
    escudo: estado.imagenes.escudoSobreOscuro?.url ?? null,
    escudoSobreClaro: estado.imagenes.escudoSobreClaro?.propia ? estado.imagenes.escudoSobreClaro.url : null,
    icono: estado.iconos.appleTouchIcon,
  }
}
