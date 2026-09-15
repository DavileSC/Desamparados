import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import SeccionPlegable from '../SeccionPlegable'

describe('SeccionPlegable', () => {
  it('empieza cerrada y se abre al pulsar el título', async () => {
    const usuario = userEvent.setup({ delay: null })
    renderWithProviders(<SeccionPlegable titulo="Actualidad"><p>contenido</p></SeccionPlegable>)

    expect(screen.queryByText('contenido')).not.toBeVisible()
    const boton = screen.getByRole('button', { name: /actualidad/i })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await usuario.click(boton)
    expect(screen.getByText('contenido')).toBeVisible()
    // No basta con que se vea: quien no ve la pantalla se entera por este atributo.
    expect(boton).toHaveAttribute('aria-expanded', 'true')
  })

  it('la que se marca como abierta empieza abierta', () => {
    renderWithProviders(<SeccionPlegable titulo="Cabecera" abiertaPorDefecto><p>contenido</p></SeccionPlegable>)
    expect(screen.getByText('contenido')).toBeVisible()
    expect(screen.getByRole('button', { name: /cabecera/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('dice si está abierta o cerrada para quien no la ve', () => {
    renderWithProviders(<SeccionPlegable titulo="Actualidad"><p>contenido</p></SeccionPlegable>)
    expect(screen.getByRole('button', { name: /actualidad/i })).toHaveAttribute('aria-expanded', 'false')
  })
})
