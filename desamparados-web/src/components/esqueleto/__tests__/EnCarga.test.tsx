import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EnCarga from '../EnCarga'
import { ESPERA_ANTES_DEL_ESQUELETO } from '../esperaDeCarga'

const esqueleto = <div data-testid="esqueleto">huesos</div>

afterEach(() => { vi.useRealTimers() })

describe('EnCarga', () => {
  it('los primeros 300 ms reserva el hueco sin enseñar nada, y luego el esqueleto', () => {
    // Se rompe si el esqueleto parpadea cuando el servidor contesta enseguida,
    // o si mientras tanto el hueco no se reserva y la página salta al llegar.
    vi.useFakeTimers()
    render(<EnCarga estado="cargando" que="las noticias" alReintentar={() => {}} esqueleto={esqueleto} />)

    expect(screen.getByTestId('esqueleto').parentElement).toHaveStyle({ visibility: 'hidden' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(ESPERA_ANTES_DEL_ESQUELETO) })
    expect(screen.getByRole('status', { name: 'Cargando las noticias' })).toContainElement(screen.getByTestId('esqueleto'))
  })

  it('si falla, deja el esqueleto quieto detrás del aviso y «Volver a intentar» vuelve a pedir', async () => {
    // Se rompe si el aviso encoge el bloque (sin el esqueleto detrás) o si el
    // botón no llama a quien vuelve a pedir.
    const reintentar = vi.fn()
    render(<EnCarga estado="error" que="la agenda" alReintentar={reintentar} esqueleto={esqueleto} />)

    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido cargar la agenda.')
    expect(screen.getByTestId('esqueleto').parentElement).toHaveClass('esqueleto-quieto')

    await userEvent.click(screen.getByRole('button', { name: /volver a intentar/i }))
    expect(reintentar).toHaveBeenCalledOnce()
  })

  it('concuerda con lo que se carga: «no se han podido cargar las noticias»', () => {
    render(<EnCarga estado="error" que="las noticias" alReintentar={() => {}} esqueleto={esqueleto} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se han podido cargar las noticias.')
  })
})
