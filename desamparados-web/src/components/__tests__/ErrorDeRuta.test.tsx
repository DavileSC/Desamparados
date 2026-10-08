import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import ErrorDeRuta from '../ErrorDeRuta'

function Explota(): never {
  throw new Error('fallo simulado al pintar')
}

describe('ErrorDeRuta', () => {
  afterEach(() => vi.restoreAllMocks())

  it('un fallo dentro de una ruta sale con el aviso en castellano, no con la pantalla del router', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '/', element: <Explota />, errorElement: <ErrorDeRuta /> }])
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/algo ha fallado en esta página/i)
    expect(screen.getByRole('button', { name: /volver a la portada/i })).toBeInTheDocument()
    expect(screen.queryByText(/unexpected application error/i)).not.toBeInTheDocument()
  })
})
