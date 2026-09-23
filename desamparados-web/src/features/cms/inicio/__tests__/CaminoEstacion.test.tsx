import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import CaminoEstacion from '../CaminoEstacion'
import { paradasDelCurso } from '../paradas'

const montar = (hoy: Date, eventos: Parameters<typeof paradasDelCurso>[1] = []) =>
  renderWithProviders(<TemaCmsProvider><CaminoEstacion hoy={hoy} eventos={eventos} /></TemaCmsProvider>)

describe('CaminoEstacion', () => {
  it('dice cuántos días faltan y para qué fecha', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByText('190')).toBeInTheDocument()
    expect(screen.getByText(/Sábado de Pasión · 20 mar 2027/)).toBeInTheDocument()
  })

  it('enseña qué parte del curso ha pasado', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByText('47 % del curso')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '47')
  })

  it('el mismo día de la estación no cuenta días de más', () => {
    montar(new Date(2026, 2, 28))
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('lleva la imagen de Nuestra Señora de los Desamparados', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByRole('img', { name: 'Nuestra Señora de los Desamparados' })).toBeInTheDocument()
  })
})

describe('paradasDelCurso', () => {
  const hoy = new Date(2026, 8, 23)

  it('empieza y acaba en un Sábado de Pasión, con la Ceniza en medio', () => {
    const paradas = paradasDelCurso(hoy, [])
    expect(paradas[0]).toMatchObject({ p: 0, titulo: 'Sábado de Pasión', fecha: '28 mar 2026' })
    expect(paradas.at(-1)).toMatchObject({ p: 1, titulo: 'Sábado de Pasión', fecha: '20 mar 2027' })
    // Pascua de 2027: 28 de marzo; la Ceniza, 46 días antes.
    expect(paradas.some((p) => p.titulo === 'Miércoles de Ceniza' && p.fecha === '10 feb')).toBe(true)
  })

  it('mete los próximos actos en su sitio y descarta los que se pisarían', () => {
    const paradas = paradasDelCurso(hoy, [
      { id: 1, title: 'Triduo', startDate: '2026-10-16T18:00:00.000Z', type: 'CULTO' },
      { id: 2, title: 'Besamanos', startDate: '2026-10-18T09:00:00.000Z', type: 'CULTO' },
    ])
    const titulos = paradas.map((p) => p.titulo)
    expect(titulos).toContain('Triduo')
    // Dos días después del Triduo: pegado a él, no cabe su etiqueta.
    expect(titulos).not.toContain('Besamanos')
    expect(paradas.map((p) => p.p)).toEqual([...paradas.map((p) => p.p)].sort((a, b) => a - b))
  })
})
