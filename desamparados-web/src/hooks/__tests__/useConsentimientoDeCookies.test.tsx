import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VIGENCIA_DECISION_MS, useConsentimientoDeCookies } from '../useConsentimientoDeCookies'

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

  it('pasados 24 meses vuelve a preguntar', () => {
    localStorage.setItem('desamparados-cookies-consent', 'accepted')
    localStorage.setItem('desamparados-cookies-consent-fecha', String(Date.now() - VIGENCIA_DECISION_MS - 1000))
    render(<Banner />)
    expect(screen.getByText('Rechazar cookies')).toBeInTheDocument()
    expect(localStorage.getItem('desamparados-cookies-consent')).toBeNull()
  })

  it('dentro de los 24 meses se respeta la decisión', () => {
    localStorage.setItem('desamparados-cookies-consent', 'declined')
    localStorage.setItem('desamparados-cookies-consent-fecha', String(Date.now() - VIGENCIA_DECISION_MS + 60_000))
    render(<Banner />)
    expect(screen.queryByText('Rechazar cookies')).not.toBeInTheDocument()
  })

  it('una decisión de antes, sin fecha, vale y empieza a contar desde hoy', () => {
    localStorage.setItem('desamparados-cookies-consent', 'accepted')
    render(<Banner />)
    expect(screen.queryByText('Rechazar cookies')).not.toBeInTheDocument()
    expect(Number(localStorage.getItem('desamparados-cookies-consent-fecha'))).toBeGreaterThan(Date.now() - 5000)
  })

  it('al decidir se guarda la fecha', () => {
    render(<Banner />)
    fireEvent.click(screen.getByText('Rechazar cookies'))
    expect(localStorage.getItem('desamparados-cookies-consent-fecha')).not.toBeNull()
  })
})
