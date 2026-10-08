import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import Retablo from '../Retablo'

import type { CuentaDeHoy } from '../../../../lib/api/panel'
import { site } from '../../../../config/site'

const montar = (hoy: Date, modulos?: string[], cuenta?: CuentaDeHoy | null) =>
  renderWithProviders(<TemaCmsProvider><Retablo hoy={hoy} cuenta={cuenta} /></TemaCmsProvider>, { modulos })

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

  it('lleva la imagen de la titular', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByRole('img', { name: site.titular })).toBeInTheDocument()
  })

  it('con la cuenta del servidor: el nombre arriba, los días y «para» con su artículo', () => {
    montar(new Date(2026, 9, 5), undefined, { nombre: 'Rosario vespertino', articulo: 'el', fecha: '2026-10-11' })
    expect(screen.getByText('Rosario vespertino')).toBeInTheDocument()
    expect(screen.getByText('11 de octubre de 2026')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('para el Rosario vespertino')).toBeInTheDocument()
  })

  it('un acto de la Agenda se nombra arriba y no lleva línea de «para»', () => {
    montar(new Date(2026, 9, 5), undefined, { nombre: 'Solemne Triduo', articulo: null, fecha: '2026-10-06' })
    expect(screen.getByText('Solemne Triduo')).toBeInTheDocument()
    expect(screen.getByText('día')).toBeInTheDocument()
    expect(screen.queryByText(/^para /)).not.toBeInTheDocument()
  })

  it('sin cuenta atrás, solo la foto', () => {
    montar(new Date(2026, 9, 5), undefined, null)
    expect(screen.getByRole('region', { name: site.titular })).toBeInTheDocument()
    expect(screen.queryByText('Sábado de Pasión')).not.toBeInTheDocument()
    expect(screen.queryByText(/^días?$/)).not.toBeInTheDocument()
  })
})
