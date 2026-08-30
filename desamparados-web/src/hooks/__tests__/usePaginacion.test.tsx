import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import { usePaginacion, TAMANO_POR_DEFECTO } from '../usePaginacion'

const CLAVE_MEMORIA = 'desamparados:porPagina'

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

  it('sin porPagina en la URL, arranca con el tamaño guardado en sessionStorage', () => {
    window.sessionStorage.setItem(CLAVE_MEMORIA, '50')
    montar()
    expect(screen.getByTestId('estado')).toHaveTextContent('1/50')
  })

  it('con porPagina en la URL y otro tamaño guardado, gana la URL', () => {
    window.sessionStorage.setItem(CLAVE_MEMORIA, '50')
    montar('/?porPagina=30')
    expect(screen.getByTestId('estado')).toHaveTextContent('1/30')
  })

  it('un porPagina invalido en la URL no borra la preferencia guardada', () => {
    // El diseño lo pide así: un enlace corrupto no debe tirar por la borda
    // una preferencia real del usuario.
    window.sessionStorage.setItem(CLAVE_MEMORIA, '30')
    montar('/?porPagina=7')
    expect(screen.getByTestId('estado')).toHaveTextContent('1/30')
  })

  it('cambiar de tamaño lo deja escrito en sessionStorage', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /cincuenta/i }))
    expect(window.sessionStorage.getItem(CLAVE_MEMORIA)).toBe('50')
  })

  it('un tamaño guardado que no está entre los cinco admitidos se descarta', () => {
    window.sessionStorage.setItem(CLAVE_MEMORIA, '7')
    montar()
    expect(screen.getByTestId('estado')).toHaveTextContent(`1/${TAMANO_POR_DEFECTO}`)
  })
})
