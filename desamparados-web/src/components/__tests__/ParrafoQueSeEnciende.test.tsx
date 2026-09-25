import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ParrafoQueSeEnciende from '../ParrafoQueSeEnciende'

const movimiento = vi.hoisted(() => ({ reducido: false }))
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => movimiento.reducido,
}))

afterEach(() => { movimiento.reducido = false })

const TEXTO = 'La fe compartida, el encuentro y la emoción'

describe('ParrafoQueSeEnciende', () => {
  it('el texto se lee entero una sola vez: las palabras sueltas no se anuncian', () => {
    const { container } = render(<ParrafoQueSeEnciende texto={TEXTO} />)

    expect(screen.getByText(TEXTO)).toBeInTheDocument()
    const pintadas = container.querySelector('[aria-hidden="true"]')
    expect(pintadas?.textContent).toBe(TEXTO)
  })

  it('con «reducir movimiento» sale encendido desde el principio', () => {
    movimiento.reducido = true
    const { container } = render(<ParrafoQueSeEnciende texto={TEXTO} />)

    const palabras = container.querySelectorAll('[aria-hidden="true"] > span > span')
    expect(palabras).toHaveLength(TEXTO.split(' ').length)
    palabras.forEach((palabra) => expect(palabra).toHaveStyle({ color: '#ffffff' }))
  })
})
