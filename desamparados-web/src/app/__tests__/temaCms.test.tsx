import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaCmsProvider, useTemaCms, CLAVE_TEMA_CMS } from '../temaCms'

function Sonda() {
  const { modo, cambiarModo, graficas } = useTemaCms()
  return (
    <div>
      <span data-testid="modo">{modo}</span>
      <span data-testid="entrada">{graficas.entrada}</span>
      <button onClick={() => cambiarModo('claro')}>Claro</button>
      <button onClick={() => cambiarModo('oscuro')}>Oscuro</button>
    </div>
  )
}

const montar = () => render(<TemaCmsProvider><Sonda /></TemaCmsProvider>)

describe('tema del CMS', () => {
  beforeEach(() => { localStorage.clear() })

  it('sin nada guardado arranca en oscuro, que es la dirección elegida', () => {
    montar()
    expect(screen.getByTestId('modo')).toHaveTextContent('oscuro')
  })

  it('al pulsar Claro cambia y lo recuerda', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
    expect(screen.getByTestId('modo')).toHaveTextContent('claro')
    expect(localStorage.getItem(CLAVE_TEMA_CMS)).toBe('claro')
  })

  it('al volver a entrar respeta lo guardado', () => {
    localStorage.setItem(CLAVE_TEMA_CMS, 'claro')
    montar()
    expect(screen.getByTestId('modo')).toHaveTextContent('claro')
  })

  it('las gráficas cambian de azul con el modo', async () => {
    montar()
    expect(screen.getByTestId('entrada')).toHaveTextContent('#3987e5')
    await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
    expect(screen.getByTestId('entrada')).toHaveTextContent('#2a78d6')
  })

  it('un valor corrupto en el almacenamiento no rompe nada', () => {
    localStorage.setItem(CLAVE_TEMA_CMS, 'fucsia')
    montar()
    expect(screen.getByTestId('modo')).toHaveTextContent('oscuro')
  })
})
