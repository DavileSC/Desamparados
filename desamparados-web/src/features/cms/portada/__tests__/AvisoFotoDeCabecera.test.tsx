import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AvisoFotoDeCabecera from '../AvisoFotoDeCabecera'

/** jsdom no carga imágenes: esta hace de foto con las medidas que se le digan, y «carga» al darle la ruta. */
function imagenDe(ancho: number, alto: number) {
  return class {
    naturalWidth = ancho
    naturalHeight = alto
    onload: (() => void) | null = null
    set src(_: string) { queueMicrotask(() => this.onload?.()) }
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('AvisoFotoDeCabecera', () => {
  it('avisa de una foto vertical', async () => {
    vi.stubGlobal('Image', imagenDe(1280, 1920))
    render(<AvisoFotoDeCabecera url="/storage/public/vertical.webp" />)
    expect(await screen.findByText(/Esta foto es vertical \(1280 × 1920 píxeles\)/)).toBeInTheDocument()
  })

  it('avisa de una foto apaisada pero estrecha', async () => {
    vi.stubGlobal('Image', imagenDe(1600, 1067))
    render(<AvisoFotoDeCabecera url="/storage/public/estrecha.webp" />)
    expect(await screen.findByText(/Esta foto mide 1600 píxeles de ancho/)).toBeInTheDocument()
  })

  it('no dice nada de una foto apaisada de 1920', async () => {
    const Imagen = imagenDe(1920, 1280)
    const cargada = vi.fn()
    vi.stubGlobal('Image', class extends Imagen { set src(_: string) { queueMicrotask(() => { this.onload?.(); cargada() }) } })
    render(<AvisoFotoDeCabecera url="/storage/public/buena.webp" />)
    await waitFor(() => expect(cargada).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sin foto no dice nada', () => {
    render(<AvisoFotoDeCabecera url="" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
