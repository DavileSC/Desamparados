import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import CampoTexto from '../CampoTexto'

describe('CampoTexto', () => {
  it('explica dónde sale en la web', () => {
    renderWithProviders(
      <CampoTexto
        etiqueta="Antetítulo"
        valor="Cultos"
        onCambio={() => {}}
        ayuda="El texto pequeño en versalitas, encima del título del bloque."
        maxLength={60}
      />,
    )

    expect(screen.getByText(/versalitas/i)).toBeInTheDocument()
  })

  it('lleva el tope al input, para avisar mientras se escribe en vez de con un 400 al guardar', () => {
    const { container } = renderWithProviders(
      <CampoTexto etiqueta="Antetítulo" valor="Cultos" onCambio={() => {}} ayuda="Ayuda" maxLength={60} />,
    )

    expect(container.querySelector('input')).toHaveAttribute('maxlength', '60')
  })

  it('al escribir, entrega el valor al formulario', async () => {
    const usuario = userEvent.setup({ delay: null })
    const onCambio = vi.fn()
    renderWithProviders(<CampoTexto etiqueta="Antetítulo" valor="" onCambio={onCambio} ayuda="Ayuda" maxLength={60} />)

    await usuario.type(screen.getByLabelText('Antetítulo'), 'Cultos')

    expect(onCambio).toHaveBeenCalledWith('C')
    expect(onCambio).toHaveBeenLastCalledWith('s')
  })
})
