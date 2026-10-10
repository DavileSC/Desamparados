import { describe, expect, it, vi } from 'vitest'
import type { SyntheticEvent } from 'react'
import { caerALaOriginal, propsDeFoto, srcsetDeSubida } from '../fotoSubida'

const HEX = '0123456789abcdef0123456789abcdef'

describe('srcsetDeSubida', () => {
  it('ofrece las dos copias y la original de una subida relativa', () => {
    expect(srcsetDeSubida(`/storage/public/${HEX}.webp`)).toBe(
      `/storage/public/${HEX}-640.webp 640w, /storage/public/${HEX}-1280.webp 1280w, /storage/public/${HEX}.webp 1920w`,
    )
  })

  it('conserva el origen de una URL absoluta', () => {
    expect(srcsetDeSubida(`https://ejemplo.es/storage/public/${HEX.toUpperCase()}.webp`)).toBe(
      `https://ejemplo.es/storage/public/${HEX.toUpperCase()}-640.webp 640w, https://ejemplo.es/storage/public/${HEX.toUpperCase()}-1280.webp 1280w, https://ejemplo.es/storage/public/${HEX.toUpperCase()}.webp 1920w`,
    )
  })

  it('las fotos de la portada de la siembra y la de por defecto también llevan copias', () => {
    expect(srcsetDeSubida('/storage/public/portada/01-virgen-rostro.webp')).toBe(
      '/storage/public/portada/01-virgen-rostro-640.webp 640w, /storage/public/portada/01-virgen-rostro-1280.webp 1280w, /storage/public/portada/01-virgen-rostro.webp 1920w',
    )
    expect(srcsetDeSubida('/images/hero-1920.webp')).toBe('/images/hero-960.webp 960w, /images/hero-1920.webp 1920w')
  })

  it.each([
    ['/images/otra.webp'],
    ['/storage/public/portada/01-virgen-rostro-640.webp'],
    [`/storage/public/portada/${HEX}.webp`],
    [`/storage/public/${HEX}.jpg`],
    [`/storage/public/${HEX}-640.webp`],
    [`/storage/public/${HEX.slice(1)}.webp`],
    [`/storage/public/${HEX}.webp?v=2`],
    [''],
    [null],
    [undefined],
  ])('no inventa copias para %s', (url) => {
    expect(srcsetDeSubida(url)).toBeUndefined()
  })
})

describe('propsDeFoto', () => {
  const evento = (img: HTMLImageElement) => ({ currentTarget: img }) as unknown as SyntheticEvent<HTMLImageElement>

  it('sin copias no pone srcset ni sizes', () => {
    const props = propsDeFoto('/images/a.webp', '100vw')
    expect(props.src).toBe('/images/a.webp')
    expect(props).not.toHaveProperty('srcSet')
    expect(props).not.toHaveProperty('sizes')
  })

  it('si falla una copia vuelve a la original sin dar la foto por rota', () => {
    const alFallar = vi.fn()
    const props = propsDeFoto(`/storage/public/${HEX}.webp`, '50vw', alFallar)
    expect(props).toMatchObject({ sizes: '50vw' })
    const img = document.createElement('img')
    img.setAttribute('srcset', 'x 640w')
    img.setAttribute('sizes', '50vw')
    props.onError(evento(img))
    expect(img.hasAttribute('srcset')).toBe(false)
    expect(img.hasAttribute('sizes')).toBe(false)
    expect(alFallar).not.toHaveBeenCalled()
    // Si después falla también la original, la foto sí está rota.
    props.onError(evento(img))
    expect(alFallar).toHaveBeenCalledTimes(1)
  })

  it('caerALaOriginal no hace nada si ya no había srcset', () => {
    expect(caerALaOriginal(document.createElement('img'))).toBe(false)
  })
})
