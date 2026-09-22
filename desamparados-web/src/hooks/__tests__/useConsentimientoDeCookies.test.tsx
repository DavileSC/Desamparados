import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useConsentimientoDeCookies } from '../useConsentimientoDeCookies'

function Banner() {
  const { sinDecidir, rechazar } = useConsentimientoDeCookies()
  return sinDecidir ? <button onClick={rechazar}>Rechazar cookies</button> : null
}

function PieDePagina() {
  const { volverAPreguntar } = useConsentimientoDeCookies()
  return <button onClick={volverAPreguntar}>Gestionar cookies</button>
}

afterEach(() => localStorage.clear())

describe('useConsentimientoDeCookies', () => {
  it('permite reabrir el banner desde otra instancia del hook y volver a decidir', () => {
    render(<><Banner /><PieDePagina /></>)
    fireEvent.click(screen.getByText('Rechazar cookies'))
    expect(screen.queryByText('Rechazar cookies')).not.toBeInTheDocument()
    expect(localStorage.getItem('desamparados-cookies-consent')).toBe('declined')

    fireEvent.click(screen.getByText('Gestionar cookies'))
    expect(screen.getByText('Rechazar cookies')).toBeInTheDocument()
    expect(localStorage.getItem('desamparados-cookies-consent')).toBeNull()

    fireEvent.click(screen.getByText('Rechazar cookies'))
    expect(screen.queryByText('Rechazar cookies')).not.toBeInTheDocument()
  })
})
