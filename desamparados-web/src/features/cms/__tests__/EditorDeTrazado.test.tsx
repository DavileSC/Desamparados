import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EditorDeTrazado from '../bloques/formularios/EditorDeTrazado'

const PARADAS = [{ hora: '17:30', lugar: 'Salida' }, { hora: '21:30', lugar: 'Entrada' }]

/** El lienzo es el padre del plano: se le da un tamaño, que jsdom no calcula. */
function conTamano() {
  const lienzo = screen.getByRole('presentation', { hidden: true }).parentElement!
  vi.spyOn(lienzo, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
  return lienzo
}

describe('EditorDeTrazado', () => {
  it('cada pulsación en el plano añade un punto, en tanto por ciento', () => {
    const onTrazado = vi.fn()
    render(<EditorDeTrazado plano="/images/recorrido-2025.webp" trazado={[]} paradas={PARADAS} onTrazado={onTrazado} onParadas={vi.fn()} />)

    fireEvent.pointerDown(conTamano(), { clientX: 50, clientY: 25 })

    expect(onTrazado).toHaveBeenCalledWith([{ x: 25, y: 25 }])
  })

  it('sin línea todavía, no se pueden situar paradas', () => {
    render(<EditorDeTrazado plano="/images/recorrido-2025.webp" trazado={[{ x: 1, y: 1 }]} paradas={PARADAS} onTrazado={vi.fn()} onParadas={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Situar las paradas' })).toBeDisabled()
  })

  it('quitar el último punto deja el resto', () => {
    const onTrazado = vi.fn()
    render(<EditorDeTrazado plano="/images/recorrido-2025.webp" trazado={[{ x: 1, y: 1 }, { x: 2, y: 2 }]} paradas={PARADAS} onTrazado={onTrazado} onParadas={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dibujar el recorrido' }))
    fireEvent.click(screen.getByRole('button', { name: /Quitar el último punto/ }))
    expect(onTrazado).toHaveBeenCalledWith([{ x: 1, y: 1 }])
  })
})
