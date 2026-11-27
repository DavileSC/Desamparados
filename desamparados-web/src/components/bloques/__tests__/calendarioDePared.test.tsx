import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import type { Bloque, MesDeCalendario } from '../../../lib/api/contenido'

const MES: MesDeCalendario = { titulo: '', texto: '', foto: '', fotoAlt: '', tono: 'normal' }

describe('el calendario de pared', () => {
  it('pinta los doce meses en orden, con su nombre puesto por la posición', () => {
    const meses = Array.from({ length: 12 }, () => MES)
    meses[2] = { ...MES, titulo: 'Sábado de Pasión', texto: 'La Virgen sale por el barrio', tono: 'destacado' }
    const bloque: Bloque = { tipo: 'calendarioDePared', titulo: 'Un año en el Grupo', meses }
    renderWithProviders(<BloquesDePagina bloques={[bloque]} />)
    const casillas = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(casillas).toHaveLength(12)
    expect(within(casillas[0]).getByRole('heading', { name: 'Enero' })).toBeInTheDocument()
    expect(within(casillas[2]).getByText('Sábado de Pasión')).toBeInTheDocument()
    expect(within(casillas[11]).getByRole('heading', { name: 'Diciembre' })).toBeInTheDocument()
  })
})
