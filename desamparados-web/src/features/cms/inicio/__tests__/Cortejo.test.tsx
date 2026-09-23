import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import Cortejo from '../Cortejo'
import type { PanelResponse } from '../../../../lib/api/panel'

const procesion = (porPuesto: PanelResponse['procesion']['porPuesto']): PanelResponse['procesion'] => ({
  anio: 2026, papeletas: porPuesto.reduce((s, p) => s + p.total, 0), porAnio: [], porPuesto, porTalla: [], porAlturaHombro: [],
})
const montar = (p: PanelResponse['procesion']) => renderWithProviders(<TemaCmsProvider><Cortejo procesion={p} /></TemaCmsProvider>)

describe('Cortejo', () => {
  it('dibuja un punto por hermano y dice cuántos van en cada puesto', () => {
    const { container } = montar(procesion([{ etiqueta: 'Nazarenos', total: 12 }, { etiqueta: 'Acólitos', total: 3 }]))
    expect(container.querySelectorAll('i')).toHaveLength(15)
    expect(screen.getByRole('img', { name: /Nazarenos, 12; Acólitos, 3/ })).toBeInTheDocument()
  })

  it('con muchas papeletas, cada punto vale por varios hermanos y lo dice', () => {
    const { container } = montar(procesion([{ etiqueta: 'Hombres de trono', total: 900 }]))
    expect(screen.getByText(/cada punto, 3 hermanos/)).toBeInTheDocument()
    expect(container.querySelectorAll('i')).toHaveLength(300)
  })

  it('sin papeletas lo dice, en vez de dejar la pieza vacía', () => {
    montar(procesion([]))
    expect(screen.getByText('Todavía no hay papeletas de sitio de 2026.')).toBeInTheDocument()
  })
})
