import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Profiler } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaCmsProvider, CLAVE_TEMA_CMS } from '../temaCms'
import { useModoCms, useTemaCms } from '../useTemaCms'

/** Un componente que solo lee colores: no debe volver a pintarse al cambiar de modo. */
function Pintor() {
  const { graficas } = useTemaCms()
  return <span data-testid="entrada">{graficas.entrada}</span>
}
/** Cuántas veces se ha pintado el Pintor (lo cuenta el Profiler de React). */
let pintadasDePintor = 0
const contar = () => { pintadasDePintor += 1 }

function Sonda() {
  const { cambiarModo } = useTemaCms()
  const modo = useModoCms()
  return (
    <div>
      <span data-testid="modo">{modo}</span>
      <button onClick={() => cambiarModo('claro')}>Claro</button>
      <button onClick={() => cambiarModo('oscuro')}>Oscuro</button>
    </div>
  )
}

const montar = () => render(<TemaCmsProvider><Sonda /><Profiler id="pintor" onRender={contar}><Pintor /></Profiler></TemaCmsProvider>)

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

  it('el modo va en el atributo de <html>, y lo que pinta no se vuelve a pintar al cambiarlo', async () => {
    montar()
    expect(document.documentElement).toHaveAttribute('data-cms-modo', 'dark')
    // Los colores son variables CSS que valen para los dos modos.
    expect(screen.getByTestId('entrada').textContent).toMatch(/^var\(--cms-g-entrada, #2a78d6\)$/)
    const antes = pintadasDePintor
    await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
    expect(document.documentElement).toHaveAttribute('data-cms-modo', 'light')
    expect(pintadasDePintor).toBe(antes)
  })

  it('un valor corrupto en el almacenamiento no rompe nada', () => {
    localStorage.setItem(CLAVE_TEMA_CMS, 'fucsia')
    montar()
    expect(screen.getByTestId('modo')).toHaveTextContent('oscuro')
  })

  describe('el cambio de tema', () => {
    // jsdom no la trae: se pone y se quita a mano.
    const documento = document as unknown as { startViewTransition?: (cb: () => void) => unknown }
    afterEach(() => { delete documento.startViewTransition; vi.restoreAllMocks() })

    it('se funde con una transición de vista cuando el navegador la tiene', async () => {
      const transicion = vi.fn((cb: () => void) => { cb(); return { updateCallbackDone: Promise.resolve(), ready: Promise.resolve(), finished: Promise.resolve() } })
      documento.startViewTransition = transicion
      montar()
      await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
      expect(transicion).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('modo')).toHaveTextContent('claro')
    })

    it('con «reducir movimiento» cambia de golpe, sin fundido', async () => {
      const transicion = vi.fn((cb: () => void) => { cb(); return { updateCallbackDone: Promise.resolve(), ready: Promise.resolve(), finished: Promise.resolve() } })
      documento.startViewTransition = transicion
      vi.spyOn(window, 'matchMedia').mockImplementation((consulta: string) => ({ matches: consulta.includes('reduce'), media: consulta, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList))
      montar()
      await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
      expect(transicion).not.toHaveBeenCalled()
      expect(screen.getByTestId('modo')).toHaveTextContent('claro')
    })

    it('sin transiciones de vista, cambia igual', async () => {
      montar()
      await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
      expect(screen.getByTestId('modo')).toHaveTextContent('claro')
    })
  })
})
