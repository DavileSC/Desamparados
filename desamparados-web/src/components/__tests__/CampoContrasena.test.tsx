import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import CampoContrasena from '../CampoContrasena'

describe('CampoContrasena', () => {
  it('nace oculto y ofrece mostrar la contraseña', () => {
    renderWithProviders(<CampoContrasena label="Contraseña" />)
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument()
  })

  it('destapa el texto al pulsar el ojo y lo vuelve a tapar', async () => {
    const usuario = userEvent.setup({ delay: null })
    renderWithProviders(<CampoContrasena label="Contraseña" />)
    const campo = screen.getByLabelText('Contraseña')
    await usuario.type(campo, 'Prueba-2026-Segura')

    await usuario.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    expect(campo).toHaveValue('Prueba-2026-Segura')

    await usuario.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
    expect(campo).toHaveValue('Prueba-2026-Segura')
  })

  it('no envía el formulario que lo rodea al pulsar el ojo', async () => {
    // Un <button> sin type dentro de un <form> envía. Aquí eso sería intentar
    // entrar con la contraseña a medio escribir.
    const enviar = vi.fn((evento: React.FormEvent) => evento.preventDefault())
    const usuario = userEvent.setup({ delay: null })
    renderWithProviders(
      <form onSubmit={enviar}>
        <CampoContrasena label="Contraseña" />
      </form>,
    )
    await usuario.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(enviar).not.toHaveBeenCalled()
  })

  it('deja el foco en el campo después de pulsar el ojo', async () => {
    const usuario = userEvent.setup({ delay: null })
    renderWithProviders(<CampoContrasena label="Contraseña" />)
    const campo = screen.getByLabelText('Contraseña')
    await usuario.click(campo)
    await usuario.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveFocus()
  })

  it('se puede alcanzar con el teclado', async () => {
    const usuario = userEvent.setup({ delay: null })
    renderWithProviders(<CampoContrasena label="Contraseña" />)
    await usuario.click(screen.getByLabelText('Contraseña'))
    await usuario.tab()
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toHaveFocus()
  })

  it('respeta el resto de props del TextField', () => {
    renderWithProviders(
      <CampoContrasena
        label="Contraseña"
        autoComplete="current-password"
        error
        helperText="Mínimo doce caracteres"
      />,
    )
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByText('Mínimo doce caracteres')).toBeInTheDocument()
  })
})
