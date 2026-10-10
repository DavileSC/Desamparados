import { describe, it, expect, vi, afterEach } from 'vitest'
import { render as pintar, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'framer-motion'
import type { ReactNode } from 'react'
import SeccionAnimada, { Revela } from '../SeccionAnimada'

// Como en App: los componentes usan `m.*`, que sin LazyMotion no observan ni animan.
const render = (ui: ReactNode) => pintar(<LazyMotion features={domAnimation} strict>{ui}</LazyMotion>)

const movimiento = vi.hoisted(() => ({ reducido: false }))
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => movimiento.reducido,
}))

afterEach(() => {
  movimiento.reducido = false
  vi.restoreAllMocks()
})

describe('SeccionAnimada', () => {
  it('deja quieto el fondo: solo se mueve el contenido, no la sección', () => {
    const { container } = render(
      <SeccionAnimada id="bloque" aria-labelledby="titulo"><p>Contenido</p></SeccionAnimada>,
    )
    const seccion = container.querySelector<HTMLElement>('section#bloque')!
    expect(seccion).toHaveAttribute('aria-labelledby', 'titulo')
    expect(seccion.style.opacity).toBe('')
    expect(seccion.style.transform).toBe('')

    const envoltorio = screen.getByText('Contenido').parentElement!
    expect(envoltorio).not.toBe(seccion)
    expect(envoltorio.style.opacity).toBe('0')
  })

  it('en cascada no envuelve el contenido: cada Revela entra por su cuenta', () => {
    render(
      <SeccionAnimada cascada>
        <ul><Revela as="li" orden={1}>Uno</Revela></ul>
      </SeccionAnimada>,
    )
    const item = screen.getByText('Uno')
    expect(item.tagName).toBe('LI')
    expect(item.style.opacity).toBe('0')
    expect(item.closest('ul')!.parentElement!.tagName).toBe('SECTION')
  })

  it('con movimiento reducido todo es visible desde el principio, sea cual sea el efecto', () => {
    movimiento.reducido = true
    render(
      <SeccionAnimada>
        <p>Plano</p>
        <ul>
          <Revela as="li">Item</Revela>
          <Revela as="li" efecto="crecer">Tarjeta</Revela>
          <Revela as="li" efecto="desvelar">Placa</Revela>
        </ul>
        <Revela efecto="cortina"><h2>Titular</h2></Revela>
      </SeccionAnimada>,
    )
    for (const texto of ['Plano', 'Item', 'Tarjeta', 'Placa', 'Titular']) {
      for (let el: HTMLElement | null = screen.getByText(texto); el; el = el.parentElement) {
        expect(el.style.opacity).not.toBe('0')
        expect(el.style.transform).toBe('')
        expect(el.getAttribute('style') ?? '').not.toContain('clip-path')
      }
    }
  })
})

describe('Revela', () => {
  it('sube mientras se funde: es lo corriente para textos y enlaces', () => {
    render(<Revela><p>Texto</p></Revela>)
    const el = screen.getByText('Texto').parentElement!
    expect(el.style.opacity).toBe('0')
    expect(el.style.transform).toContain('translateY(40px)')
    expect(el.style.transform).not.toContain('scale')
  })

  it('las tarjetas crecen además de subir', () => {
    render(<Revela efecto="crecer"><p>Tarjeta</p></Revela>)
    const el = screen.getByText('Tarjeta').parentElement!
    expect(el.style.opacity).toBe('0')
    expect(el.style.transform).toContain('scale(0.94)')
  })

  it('el titular en cortina se mueve dentro de una máscara que se queda quieta', () => {
    render(<Revela efecto="cortina" as="div"><h2>Titular</h2></Revela>)
    const texto = screen.getByText('Titular').parentElement!
    const mascara = texto.parentElement!
    // Lo que se mueve es el texto, empezando por debajo de su propia caja.
    expect(texto.style.opacity).toBe('0')
    expect(texto.style.transform).toContain('translateY(115%)')
    // La máscara ni se funde ni se mueve: es la línea por la que asoma el texto.
    expect(mascara.style.opacity).toBe('')
    expect(mascara.style.transform).toBe('')
  })

  it('la placa se desvela de izquierda a derecha, sin fundido', () => {
    render(<Revela efecto="desvelar"><p>Placa</p></Revela>)
    const el = screen.getByText('Placa').parentElement!
    expect(el.getAttribute('style')).toContain('clip-path: inset(0 100% 0 0)')
    expect(el.style.opacity).toBe('')
  })

  it('con alMontar entra nada más montarse, sin esperar a estar a la vista', () => {
    const observe = vi.spyOn(IntersectionObserver.prototype, 'observe')
    render(<Revela alMontar><p>Ya</p></Revela>)
    expect(observe).not.toHaveBeenCalled()

    render(<Revela><p>Luego</p></Revela>)
    expect(observe).toHaveBeenCalledTimes(1)
  })
})
