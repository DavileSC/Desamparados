import { describe, it, expect } from 'vitest'
import { duracionEnPalabras, problemaDelVideo, reglasDe } from '../comprobarVideo'
import { esVideoPropio } from '../../../../lib/videoPropio'

const MB = 1024 * 1024
const archivo = (nombre: string, bytes: number) => {
  const f = new File(['x'], nombre, { type: 'video/mp4' })
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}
const HD = { duracion: 12, ancho: 1280, alto: 720 }

describe('comprobar un vídeo antes de subirlo', () => {
  it('un MP4 de 720p, 12 s y 3 MB vale para el hero y para la galería', () => {
    expect(problemaDelVideo(archivo('clip.mp4', 3 * MB), HD, 'hero')).toBeNull()
    expect(problemaDelVideo(archivo('clip.MP4', 3 * MB), HD, 'galeria')).toBeNull()
  })

  it('solo MP4: un .mov del iPhone se para antes de subir', () => {
    expect(problemaDelVideo(archivo('IMG_0001.MOV', MB), HD, 'galeria')).toMatch(/MP4/)
  })

  it('el peso: 5 MB en el hero y 15 en la galería', () => {
    expect(problemaDelVideo(archivo('clip.mp4', 6 * MB), HD, 'hero')).toMatch(/6 MB.*5 MB/)
    expect(problemaDelVideo(archivo('clip.mp4', 6 * MB), HD, 'galeria')).toBeNull()
    expect(problemaDelVideo(archivo('clip.mp4', 16 * MB), HD, 'galeria')).toMatch(/15 MB/)
  })

  it('la duración: 30 s en el hero y 2 minutos en la galería', () => {
    expect(problemaDelVideo(archivo('clip.mp4', MB), { ...HD, duracion: 45 }, 'hero')).toMatch(/45 segundos.*30 segundos/)
    expect(problemaDelVideo(archivo('clip.mp4', 9 * MB), { ...HD, duracion: 75 }, 'galeria')).toBeNull()
    expect(problemaDelVideo(archivo('clip.mp4', MB), { ...HD, duracion: 135 }, 'galeria')).toMatch(/2 min 15 s.*2 minutos/)
  })

  it('si un vídeo de más de un minuto pasa del peso, aconseja 720p', () => {
    expect(problemaDelVideo(archivo('clip.mp4', 18 * MB), { ...HD, duracion: 90 }, 'galeria')).toMatch(/720p/)
    expect(problemaDelVideo(archivo('clip.mp4', 18 * MB), { ...HD, duracion: 25 }, 'galeria')).not.toMatch(/720p/)
  })

  it('la duración se dice como se habla', () => {
    expect(duracionEnPalabras(30)).toBe('30 segundos')
    expect(duracionEnPalabras(90)).toBe('1 min 30 s')
    expect(duracionEnPalabras(120)).toBe('2 minutos')
  })

  it('hasta 1080p en horizontal o en vertical', () => {
    expect(problemaDelVideo(archivo('clip.mp4', MB), { ...HD, ancho: 1080, alto: 1920 }, 'galeria')).toBeNull()
    expect(problemaDelVideo(archivo('clip.mp4', MB), { ...HD, ancho: 3840, alto: 2160 }, 'galeria')).toMatch(/3840×2160/)
  })

  it('si el navegador no sabe abrirlo, se dice que seguramente no es H.264', () => {
    expect(problemaDelVideo(archivo('clip.mp4', MB), null, 'galeria')).toMatch(/H\.264/)
  })

  it('las reglas de la ayuda salen de los mismos topes', () => {
    expect(reglasDe('hero')).toBe('MP4 en H.264, de hasta 5 MB, 30 segundos y 1080p.')
    expect(reglasDe('galeria')).toBe('MP4 en H.264, de hasta 15 MB, 2 minutos y 1080p.')
  })
})

describe('vídeo propio o de YouTube', () => {
  it('solo es propio un MP4 subido a la raíz de /storage/public', () => {
    expect(esVideoPropio('/storage/public/0123456789abcdef0123456789abcdef.mp4')).toBe(true)
    expect(esVideoPropio('https://www.youtube-nocookie.com/embed/abcdefghijk')).toBe(false)
    expect(esVideoPropio('https://otro.sitio/0123456789abcdef0123456789abcdef.mp4')).toBe(false)
  })
})
