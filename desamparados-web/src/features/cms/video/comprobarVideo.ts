import topes from '../../../../../shared/topes-video.json'
import type { UsoDeVideo } from '../../../lib/api/subida'

/**
 * Lo que se comprueba de un vídeo en el navegador, ANTES de subirlo: así nadie
 * espera a que suban 15 MB para enterarse de que el vídeo dura un minuto. Los
 * topes son los mismos que aplica el servidor (`shared/topes-video.json`), que
 * es quien decide: el códec, por ejemplo, solo lo mira él.
 */

interface DatosDeVideo {
  /** En segundos. */
  duracion: number
  ancho: number
  alto: number
}

/** Margen sobre la duración, el mismo que el del servidor (domain/mp4.ts). */
const MARGEN_SEGUNDOS = 0.5

const megas = (bytes: number) => Math.round(bytes / 1024 / 1024)

/** «45 segundos», «2 minutos», «1 min 30 s»: igual que el servidor (domain/mp4.ts). */
export function duracionEnPalabras(segundos: number): string {
  const s = Math.round(segundos)
  if (s < 60) return `${s} segundos`
  const minutos = Math.floor(s / 60)
  const resto = s % 60
  if (resto) return `${minutos} min ${resto} s`
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`
}

/**
 * A partir de un minuto, con el peso tope repartido entre más segundos, un
 * 1080p se ve peor que un 720p bien hecho. Se aconseja al pasar de aquí.
 */
const CONSEJO_720P_DESDE_S = 60

/** Las reglas de un uso, en una frase para la ayuda del campo. */
export function reglasDe(uso: UsoDeVideo): string {
  const { maxBytes, maxSegundos } = topes[uso]
  return `MP4 en H.264, de hasta ${megas(maxBytes)} MB, ${duracionEnPalabras(maxSegundos)} y 1080p.`
}

/**
 * Duración y tamaño del vídeo, leídos por el propio navegador sin subir nada.
 * `null` si el navegador no sabe abrirlo, que casi siempre es que no está en
 * H.264 (el H.265 de los iPhone, por ejemplo).
 */
export function leerVideo(archivo: File): Promise<DatosDeVideo | null> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(archivo)
    const video = document.createElement('video')
    const terminar = (datos: DatosDeVideo | null) => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      resolver(datos)
    }
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => terminar({ duracion: video.duration, ancho: video.videoWidth, alto: video.videoHeight })
    video.onerror = () => terminar(null)
    video.src = url
  })
}

/** Qué le pasa al vídeo para no poder subirse aquí, o `null` si parece que vale. */
export function problemaDelVideo(archivo: File, datos: DatosDeVideo | null, uso: UsoDeVideo): string | null {
  const { maxBytes, maxSegundos } = topes[uso]
  if (!archivo.name.toLowerCase().endsWith('.mp4')) {
    return 'El vídeo tiene que ser un MP4. Pásalo por HandBrake (gratuito) con el formato MP4 y el códec H.264.'
  }
  if (archivo.size > maxBytes) {
    const largo = datos && datos.duracion > CONSEJO_720P_DESDE_S
    return `El vídeo pesa ${megas(archivo.size)} MB y aquí el máximo son ${megas(maxBytes)} MB. `
      + (largo ? 'Expórtalo a 720p en HandBrake: con esta duración se verá igual de bien y pesará bastante menos.' : 'Recórtalo o comprímelo más.')
  }
  if (!datos) {
    return 'Este navegador no puede abrir el vídeo: seguramente no está en H.264. Pásalo por HandBrake (gratuito) con el formato MP4 y el códec H.264.'
  }
  if (datos.duracion > maxSegundos + MARGEN_SEGUNDOS) {
    return `El vídeo dura ${duracionEnPalabras(datos.duracion)} y aquí el máximo son ${duracionEnPalabras(maxSegundos)}. `
      + 'Recórtalo antes de subirlo, o súbelo a YouTube o Vimeo.'
  }
  if (Math.max(datos.ancho, datos.alto) > topes.ladoMayor || Math.min(datos.ancho, datos.alto) > topes.ladoMenor) {
    return `El vídeo es de ${datos.ancho}×${datos.alto} y el máximo es ${topes.ladoMayor}×${topes.ladoMenor} (1080p). Redúcelo antes de subirlo.`
  }
  return null
}

/**
 * Una foto del vídeo, sacada en el navegador, para usarla de portada: es lo
 * que se ve en la galería hasta que alguien le da al play. Así nadie tiene que
 * hacer una captura a mano, y el servidor no tiene que abrir el vídeo (no hay
 * ffmpeg ni CPU para eso). Se toma a un segundo del principio, o a la mitad si
 * es más corto, porque el primer fotograma suele ser negro.
 *
 * `null` si no se puede (un navegador sin permiso para pintar el vídeo): la
 * portada se sube entonces a mano.
 */
export function sacarFotograma(archivo: File): Promise<File | null> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(archivo)
    const video = document.createElement('video')
    const terminar = (foto: File | null) => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      resolver(foto)
    }
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => { video.currentTime = Math.min(1, video.duration / 2) }
    video.onseeked = () => {
      const lienzo = document.createElement('canvas')
      lienzo.width = video.videoWidth
      lienzo.height = video.videoHeight
      const contexto = lienzo.getContext('2d')
      if (!contexto || !lienzo.width) return terminar(null)
      contexto.drawImage(video, 0, 0)
      lienzo.toBlob(
        (blob) => terminar(blob ? new File([blob], 'portada-del-video.jpg', { type: 'image/jpeg' }) : null),
        'image/jpeg',
        0.85,
      )
    }
    video.onerror = () => terminar(null)
    video.src = url
  })
}
