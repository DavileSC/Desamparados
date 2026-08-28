import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import ErrorBoundary from '../ErrorBoundary'

function Explota(): never {
  throw new Error('fallo simulado al pintar')
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra los hijos cuando no hay error', () => {
    renderWithProviders(
      <ErrorBoundary>
        <p>contenido normal</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('contenido normal')).toBeInTheDocument()
  })

  it('muestra un aviso accesible en vez de una página en blanco', () => {
    // React registra el error en consola aunque lo capturemos: lo silenciamos
    // para que la salida del test no parezca un fallo.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithProviders(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>
    )

    const aviso = screen.getByRole('alert')
    expect(aviso).toBeInTheDocument()
    expect(screen.getByText(/algo ha fallado en esta página/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /volver a la portada/i })).toBeInTheDocument()
  })
})
