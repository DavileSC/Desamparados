import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useCookieConsent } from '../useCookieConsent'

function Banner() {
  const { pending, decline } = useCookieConsent()
  return pending ? <button onClick={decline}>Rechazar cookies</button> : null
}

function PieDePagina() {
  const { reset } = useCookieConsent()
  return <button onClick={reset}>Gestionar cookies</button>
}

afterEach(() => localStorage.clear())

describe('useCookieConsent', () => {
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
