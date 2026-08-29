import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import DialogoConfirmacion from '../DialogoConfirmacion'

describe('DialogoConfirmacion', () => {
  it('cerrado no enseña nada', () => {
    renderWithProviders(
      <DialogoConfirmacion abierto={false} titulo="¿Guardar?" mensaje="Se van a guardar los cambios." onConfirmar={() => {}} onCancelar={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('dice qué se va a hacer y a qué afecta', () => {
    renderWithProviders(
      <DialogoConfirmacion abierto titulo="¿Guardar los cambios?" mensaje="Ficha de Rocío Gómez Marín." onConfirmar={() => {}} onCancelar={() => {}} />,
    )
    expect(screen.getByRole('dialog')).toHaveAccessibleName('¿Guardar los cambios?')
    expect(screen.getByText('Ficha de Rocío Gómez Marín.')).toBeInTheDocument()
  })

  it('avisa a quien lo abrió de lo que se ha pulsado', () => {
    const confirmar = vi.fn()
    const cancelar = vi.fn()
    renderWithProviders(
      <DialogoConfirmacion abierto titulo="¿Guardar?" mensaje="." textoConfirmar="Guardar" onConfirmar={confirmar} onCancelar={cancelar} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(confirmar).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(cancelar).toHaveBeenCalledOnce()
  })

  it('lo que borra se pinta en rojo', () => {
    // El color no es el único aviso (el texto también lo dice), pero un botón
    // de borrar con el mismo aspecto que uno de guardar invita al accidente.
    renderWithProviders(
      <DialogoConfirmacion abierto peligro titulo="¿Eliminar?" mensaje="." textoConfirmar="Eliminar" onConfirmar={() => {}} onCancelar={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Eliminar' }).className).toMatch(/colorError/)
  })
})
