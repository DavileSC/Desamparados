import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ProporcionEstados from '../ProporcionEstados'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const estados = [
  { clave: 'PAGADO', etiqueta: 'Cobrados', total: 1126, importe: 33780, estado: 'ok' as const },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes', total: 57, importe: 1710, estado: 'aviso' as const },
  { clave: 'DEVUELTO', etiqueta: 'Devueltos por el banco', total: 14, importe: 420, estado: 'error' as const },
]
const euros = (v: number) => `${v} €`
const numero = (v: number) => `${v}`

describe('ProporcionEstados', () => {
  it('enseña el porcentaje cobrado con su cuenta', () => {
    renderWithProviders(<ProporcionEstados estados={estados} paleta={paleta} formatoImporte={euros} formatoNumero={numero} />)
    expect(screen.getByText('94 %')).toBeInTheDocument()
    expect(screen.getByText(/1126 de 1197/)).toBeInTheDocument()
  })

  it('cada estado lleva texto, número e importe, no solo color', () => {
    renderWithProviders(<ProporcionEstados estados={estados} paleta={paleta} formatoImporte={euros} formatoNumero={numero} />)
    expect(screen.getByText('Devueltos por el banco')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('420 €')).toBeInTheDocument()
  })

  it('el recuento pasa por formatoNumero, no en crudo', () => {
    const conMiles = { total: 1284, etiqueta: 'Cobrados', clave: 'PAGADO', importe: 100, estado: 'ok' as const }
    renderWithProviders(
      <ProporcionEstados estados={[conMiles]} paleta={paleta} formatoImporte={euros} formatoNumero={(v) => `${v}·f`} />,
    )
    expect(screen.getByText('1284·f')).toBeInTheDocument()
  })

  it('sin recibos no divide por cero', () => {
    renderWithProviders(<ProporcionEstados estados={[]} paleta={paleta} formatoImporte={euros} formatoNumero={numero} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
