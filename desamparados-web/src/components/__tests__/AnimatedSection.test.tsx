import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AnimatedSection, { Revela } from '../AnimatedSection'

const movimiento = vi.hoisted(() => ({ reducido: false }))
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => movimiento.reducido,
}))

afterEach(() => { movimiento.reducido = false })

describe('AnimatedSection', () => {
  it('deja quieto el fondo: solo se mueve el contenido, no la sección', () => {
    const { container } = render(
      <AnimatedSection id="bloque" aria-labelledby="titulo"><p>Contenido</p></AnimatedSection>,
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
      <AnimatedSection cascada>
        <ul><Revela as="li" orden={1}>Uno</Revela></ul>
      </AnimatedSection>,
    )
    const item = screen.getByText('Uno')
    expect(item.tagName).toBe('LI')
    expect(item.style.opacity).toBe('0')
    expect(item.closest('ul')!.parentElement!.tagName).toBe('SECTION')
  })

  it('con movimiento reducido todo es visible desde el principio', () => {
    movimiento.reducido = true
    render(
      <AnimatedSection>
        <p>Plano</p>
        <ul><Revela as="li">Item</Revela></ul>
      </AnimatedSection>,
    )
    for (const texto of ['Plano', 'Item']) {
      for (let el: HTMLElement | null = screen.getByText(texto); el; el = el.parentElement) {
        expect(el.style.opacity).not.toBe('0')
      }
    }
  })
})
