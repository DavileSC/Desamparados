import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import { usePaginacion, TAMANO_POR_DEFECTO } from '../usePaginacion'

function Sonda({ prefijo }: { prefijo?: string }) {
  const { pagina, porPagina, irAPagina, cambiarTamano, reiniciar } = usePaginacion(prefijo)
  return <>
    <span data-testid="estado">{pagina}/{porPagina}</span>
    <button onClick={() => irAPagina(3)}>ir a la tres</button>
    <button onClick={() => cambiarTamano(50)}>cincuenta</button>
    <button onClick={() => reiniciar()}>reiniciar</button>
  </>
}

function montar(ruta = '/', prefijo?: string) {
  return renderWithProviders(<Sonda prefijo={prefijo} />, { ruta })
}

// El tamaño se recuerda en sessionStorage: sin limpiarlo, un test arrastra
// al siguiente el 50 que eligió.
beforeEach(() => { window.sessionStorage.clear() })

describe('usePaginacion', () => {
  it('sin nada en la URL arranca en la primera página con el tamaño por defecto', () => {
    montar()
    expect(screen.getByTestId('estado')).toHaveTextContent(`1/${TAMANO_POR_DEFECTO}`)
  })

  it('lee la página y el tamaño de la URL', () => {
    montar('/?pagina=4&porPagina=30')
    expect(screen.getByTestId('estado')).toHaveTextContent('4/30')
  })

  it('un tamaño que no está entre los cinco admitidos se descarta', () => {
    montar('/?porPagina=7')
    expect(screen.getByTestId('estado')).toHaveTextContent(`1/${TAMANO_POR_DEFECTO}`)
  })

  it('cambiar de tamaño vuelve a la primera página', async () => {
    const user = userEvent.setup()
    montar('/?pagina=4')
    await user.click(screen.getByRole('button', { name: /cincuenta/i }))
    expect(screen.getByTestId('estado')).toHaveTextContent('1/50')
  })

  it('reiniciar vuelve a la primera página y conserva el tamaño', async () => {
    const user = userEvent.setup()
    montar('/?pagina=4&porPagina=30')
    await user.click(screen.getByRole('button', { name: /reiniciar/i }))
    expect(screen.getByTestId('estado')).toHaveTextContent('1/30')
  })

  it('con prefijo usa parámetros propios, para dos listados en una pantalla', () => {
    montar('/?paginaEnseres=2&pagina=9', 'Enseres')
    expect(screen.getByTestId('estado')).toHaveTextContent('2/')
  })
})
