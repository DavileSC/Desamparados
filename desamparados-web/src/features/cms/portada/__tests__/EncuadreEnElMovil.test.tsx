import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EncuadreEnElMovil from '../EncuadreEnElMovil'

describe('el encuadre de una foto de la cabecera en el móvil', () => {
  it('sin elegir, está donde siempre (35 %), y el deslizador lo cambia', () => {
    const onCambio = vi.fn()
    render(<EncuadreEnElMovil url="/images/hero-1920.webp" onCambio={onCambio} />)
    const deslizador = screen.getByRole('slider', { name: 'Encuadre en el móvil' })
    expect(deslizador).toHaveAttribute('aria-valuenow', '35')
    fireEvent.keyDown(deslizador, { key: 'ArrowRight' })
    expect(onCambio).toHaveBeenCalledWith(40)
  })

  it('enseña el que tiene guardado', () => {
    render(<EncuadreEnElMovil url="/images/hero-1920.webp" valor={70} onCambio={() => {}} />)
    expect(screen.getByRole('slider', { name: 'Encuadre en el móvil' })).toHaveAttribute('aria-valuenow', '70')
  })
})
