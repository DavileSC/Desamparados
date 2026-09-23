import { segunModo, type ModoCms } from './cms'

/**
 * El fondo de las tarjetas del Inicio: la tarjeta lisa y quieta con un velo
 * plano de su color y el borde del mismo tono. Cada tarjeta elige el tono por
 * lo que cuenta (dinero que entra, azul; el censo y la casa, burdeos; la
 * procesión, oro) y así se distinguen sin etiquetas de colores.
 *
 * La vida la pone el fondo animado de la pantalla: con focos que se mecían
 * también en las tarjetas, las dos capas competían y el contenido perdía
 * protagonismo.
 */
export type TonoTarjeta = 'burdeos' | 'azul' | 'oro' | 'rosa' | 'neutro'

const TONO: Record<TonoTarjeta, string> = {
  burdeos: '160, 61, 68',
  rosa: '240, 138, 147',
  azul: '57, 135, 229',
  oro: '201, 171, 60',
  // Sin color propio: el de la casa, a media fuerza.
  neutro: '160, 61, 68',
}

/** Cuánto tiñen el velo y el borde en cada modo. */
const INTENSIDAD: Record<ModoCms, { velo: number; borde: number }> = {
  oscuro: { velo: 0.07, borde: 0.16 },
  claro: { velo: 0.05, borde: 0.18 },
}

/**
 * Estilos (sx) de una tarjeta con velo de color. `base` es el color de tarjeta.
 * Valen para los dos modos a la vez (`light-dark`): el modo lo decide el CMS
 * sin volver a pintar. `fijo` los ata a un modo, para una pieza que no cambia
 * con el tema (el camino a la estación, siempre oscuro).
 */
export function fondoTarjeta(tono: TonoTarjeta, base: string, fijo?: ModoCms) {
  const rgb = TONO[tono]
  const factor = tono === 'neutro' ? 0.5 : 1
  const en = (modo: ModoCms, que: 'velo' | 'borde') => `rgba(${rgb}, ${INTENSIDAD[modo][que] * factor})`
  const segun = (claro: string, oscuro: string) => (fijo ? (fijo === 'claro' ? claro : oscuro) : segunModo(claro, oscuro))
  const capa = segun(en('claro', 'velo'), en('oscuro', 'velo'))
  return {
    backgroundColor: base,
    // Un degradado de un solo color pone el velo encima del color de la
    // tarjeta sin cambiarlo.
    backgroundImage: `linear-gradient(0deg, ${capa}, ${capa})`,
    border: '1px solid',
    borderColor: segun(en('claro', 'borde'), en('oscuro', 'borde')),
    boxShadow: `0 1px 2px ${segun('rgba(27, 28, 26, 0.05)', 'transparent')}`,
  }
}
