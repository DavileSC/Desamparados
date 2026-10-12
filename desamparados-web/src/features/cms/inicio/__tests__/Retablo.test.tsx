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
  it('sin cuenta del servidor (un backend anterior) no se inventa ninguna', () => {
    montar(new Date(2026, 8, 11), ['procesion'])
    expect(screen.getByRole('region', { name: site.titular })).toBeInTheDocument()
    expect(screen.queryByText(/^días?$/)).not.toBeInTheDocument()
  })

  it('el mismo día de la salida no cuenta días de más', () => {
    montar(new Date(2026, 2, 28), undefined, { nombre: 'Salida extraordinaria', articulo: 'la', fecha: '2026-03-28' })
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('para la Salida extraordinaria')).toBeInTheDocument()
  })

  it('lleva la imagen de la titular', () => {
    montar(new Date(2026, 8, 11), undefined, null)
    expect(screen.getByRole('img', { name: site.titular })).toBeInTheDocument()
  })

  it('con la cuenta del servidor: el nombre arriba, los días y «para» con su artículo', () => {
    montar(new Date(2026, 9, 5), undefined, { nombre: 'Traslado de la Imagen', articulo: 'el', fecha: '2026-10-11' })
    expect(screen.getByText('Traslado de la Imagen')).toBeInTheDocument()
    expect(screen.getByText('11 de octubre de 2026')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('para el Traslado de la Imagen')).toBeInTheDocument()
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
    expect(screen.queryByText(/^días?$/)).not.toBeInTheDocument()
  })
})
