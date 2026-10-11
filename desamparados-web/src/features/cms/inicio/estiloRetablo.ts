import { segunModo } from '../../../theme/cms'
import { CORMORANT } from '../../actualidad/agenda/letraAlmanaque'
import { MARCA } from '../../../theme/marca'

/**
 * La letra y los colores del Inicio «Retablo»: títulos y cifras en Cormorant,
 * acento de oro viejo, filetes finos en vez de tarjetas con velo.
 */

/** El oro de la columna de la Virgen, que siempre es oscura. */
export const ORO_CLARO = MARCA.acentoViejo
/** El oro de acento del resto, según el tema. */
export const ORO = segunModo(MARCA.acentoViejoSobreClaro, MARCA.acentoViejo)
/** El oro de las gráficas: algo más apagado que el del texto. */
export const ORO_GRAFICA = segunModo(MARCA.acentoGraficaClaro, MARCA.acentoGraficaOscuro)
export const ROJO_GRAFICA = segunModo('#b0414a', '#d4586a')
export const AZUL_GRAFICA = segunModo('#5b7fae', '#8fa7c9')
export const VERDE = segunModo('#2f7d45', '#8fc59a')
export const ROSA_URGENTE = segunModo('#b0303f', '#e07a8a')

export const FILETE = segunModo('rgba(27,28,26,.12)', 'rgba(239,233,225,.12)')
export const FILETE_SUAVE = segunModo('rgba(27,28,26,.08)', 'rgba(239,233,225,.08)')
export const FONDO_PIEZA = segunModo('rgba(255,255,255,.55)', '#17141a')

/** Las etiquetas en versalitas espaciadas: «HERMANOS ACTIVOS». */
export const VERSALITAS = { fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary' } as const

/** Títulos y cifras. */
export const SERIF = { fontFamily: CORMORANT, fontWeight: 500, fontVariantNumeric: 'lining-nums' } as const
