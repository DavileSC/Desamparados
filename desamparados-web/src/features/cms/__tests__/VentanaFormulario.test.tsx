import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import VentanaFormulario from '../VentanaFormulario'

function montar(props: Partial<Parameters<typeof VentanaFormulario>[0]> = {}) {
  const onGuardar = vi.fn()
  const onCerrar = vi.fn()
  renderWithProviders(
    <VentanaFormulario abierto titulo="Nueva noticia" sucio={false} onGuardar={onGuardar} onCerrar={onCerrar} {...props}>
      <input aria-label="Título" />
    </VentanaFormulario>,
  )
  return { onGuardar, onCerrar }
}

describe('VentanaFormulario', () => {
  it('enseña el formulario con su título y guarda con el botón', async () => {
    const user = userEvent.setup()
    const { onGuardar } = montar()

    expect(screen.getByRole('dialog', { name: 'Nueva noticia' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onGuardar).toHaveBeenCalledTimes(1)
  })

  it('sin nada escrito, cancelar cierra sin preguntar', async () => {
    const user = userEvent.setup()
    const { onCerrar } = montar()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/descartar lo escrito/i)).not.toBeInTheDocument()
  })

  it('con algo escrito, cerrar pregunta antes de tirarlo', async () => {
    // Se rompe si un clic fuera o un Esc se lleva por delante una noticia a medias.
    const user = userEvent.setup()
    const { onCerrar } = montar({ sucio: true })

    await user.keyboard('{Escape}')
    expect(await screen.findByText(/descartar lo escrito/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /seguir escribiendo/i }))
    expect(onCerrar).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText(/descartar lo escrito/i)).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Descartar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('el error del servidor sale dentro de la ventana', () => {
    montar({ error: 'El título ya existe.' })
    expect(screen.getByRole('dialog', { name: 'Nueva noticia' })).toHaveTextContent('El título ya existe.')
  })

  it('no deja guardar mientras falten datos ni mientras guarda', () => {
    montar({ puedeGuardar: false })
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })
})
