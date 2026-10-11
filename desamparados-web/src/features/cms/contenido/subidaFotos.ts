import { subirImagenPublica } from '../../../lib/api/subida'

/** Los mismos límites que la subida del servidor (upload.middleware.ts): se avisa antes de enviar. */
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES_FOTO = 5 * 1024 * 1024

/** Cuántas fotos suben a la vez: más no acaba antes, porque el servidor analiza cada una. */
const A_LA_VEZ = 3

/** Por qué no se puede subir una foto, o `null` si vale. */
function problemaDeFoto(archivo: File): string | null {
  if (!TIPOS_FOTO.includes(archivo.type)) return 'tiene que ser JPG, PNG o WebP'
  if (archivo.size > MAX_BYTES_FOTO) return 'pesa más de 5 MB'
  return null
}

export interface ResultadoSubida {
  /** Las rutas de las que han subido, en el mismo orden en que se eligieron. */
  rutas: string[]
  /** Las que no: su nombre y el motivo. */
  fallos: { nombre: string; motivo: string }[]
  /** Las que no se intentaron porque la galería no tenía sitio. */
  sobrantes: number
}

/**
 * Sube varias fotos, unas pocas a la vez, y devuelve las rutas en el orden en
 * que se eligieron (no en el que terminan: una galería se ordena a propósito).
 * Solo se intentan las que caben: `hueco` es lo que le queda a la galería.
 */
export async function subirFotos(
  archivos: File[],
  hueco: number,
  alAvanzar?: (hechas: number, total: number) => void,
): Promise<ResultadoSubida> {
  const fallos: ResultadoSubida['fallos'] = []
  const validas: File[] = []
  for (const archivo of archivos) {
    const problema = problemaDeFoto(archivo)
    if (problema) fallos.push({ nombre: archivo.name, motivo: problema })
    else validas.push(archivo)
  }
  const aSubir = validas.slice(0, Math.max(hueco, 0))
  const sobrantes = validas.length - aSubir.length

  const rutas: (string | null)[] = new Array(aSubir.length).fill(null)
  let siguiente = 0
  let hechas = 0
  alAvanzar?.(0, aSubir.length)
  const trabajador = async () => {
    while (siguiente < aSubir.length) {
      const indice = siguiente++
      try {
        rutas[indice] = await subirImagenPublica(aSubir[indice])
      } catch (e: unknown) {
        fallos.push({ nombre: aSubir[indice].name, motivo: e instanceof Error ? e.message : 'no se ha podido subir' })
      }
      hechas += 1
      alAvanzar?.(hechas, aSubir.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, aSubir.length) }, trabajador))

  return { rutas: rutas.filter((r): r is string => r !== null), fallos, sobrantes }
}
