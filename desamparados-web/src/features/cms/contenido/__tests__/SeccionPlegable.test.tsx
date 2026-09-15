import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import SeccionPlegable from '../SeccionPlegable'
import CampoTexto from '../CampoTexto'

describe('SeccionPlegable', () => {
  it('empieza cerrada y se abre al pulsar el título', async () => {
    const usuario = userEvent.setup({ delay: null })
    renderWithProviders(<SeccionPlegable titulo="Actualidad"><p>contenido</p></SeccionPlegable>)

    expect(screen.queryByText('contenido')).not.toBeVisible()
    await usuario.click(screen.getByRole('button', { name: /actualidad/i }))
    expect(screen.getByText('contenido')).toBeVisible()
  })

  it('la que se marca como abierta empieza abierta', () => {
    renderWithProviders(<SeccionPlegable titulo="Cabecera" abiertaPorDefecto><p>contenido</p></SeccionPlegable>)
    expect(screen.getByText('contenido')).toBeVisible()
  })

  it('dice si está abierta o cerrada para quien no la ve', () => {
    renderWithProviders(<SeccionPlegable titulo="Actualidad"><p>contenido</p></SeccionPlegable>)
    expect(screen.getByRole('button', { name: /actualidad/i })).toHaveAttribute('aria-expanded', 'false')
  })
})

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
})
