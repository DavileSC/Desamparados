import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import Cortejo from '../Cortejo'
import type { PanelResponse } from '../../../../lib/api/panel'

const procesion = (porPuesto: PanelResponse['procesion']['porPuesto'], porAnio: PanelResponse['procesion']['porAnio'] = []): PanelResponse['procesion'] => ({
  anio: 2026, papeletas: porPuesto.reduce((s, p) => s + p.total, 0), porAnio, porPuesto, porTalla: [], porAlturaHombro: [],
})
const montar = (p: PanelResponse['procesion']) => renderWithProviders(<TemaCmsProvider><Cortejo procesion={p} /></TemaCmsProvider>)

describe('Cortejo', () => {
  it('reparte el anillo por puesto y la leyenda dice cuántos y qué parte del cortejo', () => {
    const { container } = montar(procesion([{ etiqueta: 'Nazareno de cirio', total: 75 }, { etiqueta: 'Acólito', total: 25 }]))
    expect(screen.getByRole('img', { name: 'Papeletas por puesto: Nazareno de cirio, 75; Acólito, 25' })).toBeInTheDocument()
    // Un trozo por puesto, más la pista de fondo.
    expect(container.querySelectorAll('svg circle')).toHaveLength(3)

    const leyenda = screen.getByRole('list')
    const cirio = within(leyenda).getByText('Nazareno de cirio').closest('li')!
    expect(within(cirio).getByText('75')).toBeInTheDocument()
    expect(within(cirio).getByText('75 % del cortejo')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('dice cuántas más que el año pasado y enseña los últimos años', () => {
    montar(procesion([{ etiqueta: 'Nazareno de cirio', total: 181 }], [{ anio: 2025, total: 131 }, { anio: 2026, total: 181 }]))
    expect(screen.getByText('+50 que en 2025')).toBeInTheDocument()
    expect(screen.getByText('2025:')).toBeInTheDocument()
  })

  it('sin papeletas lo dice, en vez de dejar la pieza vacía', () => {
    montar(procesion([]))
    expect(screen.getByText('Todavía no hay papeletas de sitio de 2026.')).toBeInTheDocument()
  })
})
