import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { olvidarCuentas, useCuenta } from '../animaciones'

function Cifra({ valor }: { valor: number }) {
  return <span data-testid="cifra">{Math.round(useCuenta(valor))}</span>
}

describe('la cuenta de las cifras del Inicio', () => {
  beforeEach(() => {
    olvidarCuentas()
    // Un sistema que no pide reducir el movimiento: aquí sí se anima.
    vi.spyOn(window, 'matchMedia').mockImplementation((consulta: string) => ({
      matches: consulta.includes('no-preference'), media: consulta,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
    } as unknown as MediaQueryList))
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('la primera vez cuenta desde cero', () => {
    render(<Cifra valor={181} />)
    expect(screen.getByTestId('cifra')).toHaveTextContent('0')
  })

  it('al volver al Inicio en la misma visita, la cifra sale ya entera', () => {
    const primera = render(<Cifra valor={181} />)
    primera.unmount()
    render(<Cifra valor={181} />)
    expect(screen.getByTestId('cifra')).toHaveTextContent('181')
  })

  it('las cifras de la primera pantalla cuentan todas, no solo la primera que se monta', () => {
    render(<><Cifra valor={181} /><Cifra valor={278} /></>)
    expect(screen.getAllByTestId('cifra').map((c) => c.textContent)).toEqual(['0', '0'])
  })
})
