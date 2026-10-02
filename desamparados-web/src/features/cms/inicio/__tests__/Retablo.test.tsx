import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import Retablo from '../Retablo'

const montar = (hoy: Date, modulos?: string[]) => renderWithProviders(<TemaCmsProvider><Retablo hoy={hoy} /></TemaCmsProvider>, { modulos })

describe('Retablo', () => {
  it('dice cuántos días faltan y para qué fecha', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByText('190')).toBeInTheDocument()
    expect(screen.getByText('20 de marzo de 2027')).toBeInTheDocument()
  })

  it('con Procesión apagada no cuenta los días para la estación', () => {
    montar(new Date(2026, 8, 11), [])
    expect(screen.queryByText('para la estación de penitencia')).not.toBeInTheDocument()
    expect(screen.queryByText('190')).not.toBeInTheDocument()
  })

  it('con Procesión encendida, sí', () => {
    montar(new Date(2026, 8, 11), ['procesion'])
    expect(screen.getByText('para la estación de penitencia')).toBeInTheDocument()
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
