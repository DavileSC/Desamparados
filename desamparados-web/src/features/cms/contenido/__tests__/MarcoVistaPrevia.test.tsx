import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MarcoVistaPrevia from '../MarcoVistaPrevia'

function Contenido({ onBoton, onEnviar }: { onBoton: () => void; onEnviar: () => void }) {
  return (
    <>
      <button type="button" onClick={onBoton}>Medio siguiente</button>
      <a href="/corporacion/historia">Historia</a>
      <form onSubmit={onEnviar}><button type="submit">Enviar</button></form>
    </>
  )
}

describe('MarcoVistaPrevia', () => {
  it('por defecto es solo para mirar: queda fuera del alcance del teclado y de los lectores', () => {
    render(<MarcoVistaPrevia testId="marco"><Contenido onBoton={vi.fn()} onEnviar={vi.fn()} /></MarcoVistaPrevia>)
    const marco = screen.getByTestId('marco')
    expect(marco).toHaveAttribute('inert')
    expect(marco).toHaveAttribute('aria-hidden', 'true')
  })

  it('interactiva, lo que se mueve responde, pero ningún enlace lleva fuera ni se envía nada', () => {
    const onBoton = vi.fn()
    const onEnviar = vi.fn()
    render(<MarcoVistaPrevia testId="marco" interactiva><Contenido onBoton={onBoton} onEnviar={onEnviar} /></MarcoVistaPrevia>)
    const marco = screen.getByTestId('marco')
    expect(marco).not.toHaveAttribute('inert')
    expect(marco).not.toHaveAttribute('aria-hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Medio siguiente' }))
    expect(onBoton).toHaveBeenCalledOnce()

    // `fireEvent` devuelve false si alguien canceló el evento: el navegador no seguiría el enlace.
    expect(fireEvent.click(screen.getByRole('link', { name: 'Historia' }))).toBe(false)

    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')!)
    expect(onEnviar).not.toHaveBeenCalled()
    expect(screen.getByText(/puedes pasar las fotos y probarla/i)).toBeInTheDocument()
  })
})
