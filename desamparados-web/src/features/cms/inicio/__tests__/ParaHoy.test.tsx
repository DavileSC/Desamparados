import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import ParaHoy from '../ParaHoy'
import type { Tarea } from '../tareas'

const TAREAS: Tarea[] = [
  {
    clave: 'recibos-devueltos', prioridad: 'urgente', etiqueta: 'Urgente',
    titulo: '14 recibos devueltos', detalle: 'Tesorería · ejercicio 2026',
    cargo: 'Tesorería', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'],
    accion: { texto: 'Revisar', href: '/cms/tesoreria' },
  },
  {
    clave: 'noticias-borrador', prioridad: 'pendiente', etiqueta: 'Pendiente',
    titulo: '2 noticias en borrador', detalle: 'Noticias · sin publicar',
    cargo: 'Redes', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
    accion: { texto: 'Publicar', href: '/cms/noticias' },
  },
]

const montar = (tareas: Tarea[], role?: string) =>
  renderWithProviders(<TemaCmsProvider><ParaHoy tareas={tareas} role={role} /></TemaCmsProvider>)

describe('ParaHoy', () => {
  it('el que lleva el asunto ve el botón', () => {
    montar(TAREAS, 'REDES')
    expect(screen.getByRole('link', { name: /Publicar/ })).toHaveAttribute('href', '/cms/noticias')
  })

  it('lo del resto de la junta va sin botón y con quién lo lleva', () => {
    montar(TAREAS, 'REDES')
    expect(screen.getByText('En el resto de la junta')).toBeInTheDocument()
    expect(screen.getByText('Lo lleva Tesorería')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Revisar/ })).not.toBeInTheDocument()
  })

  it('el Hermano Mayor ve todos los botones y ningún «lo lleva»', () => {
    montar(TAREAS, 'HERMANO_MAYOR')
    expect(screen.getByRole('link', { name: /Revisar/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Publicar/ })).toBeInTheDocument()
    expect(screen.queryByText(/Lo lleva/)).not.toBeInTheDocument()
  })

  it('cada estado se lee en palabras, no solo por su color', () => {
    montar(TAREAS, 'ADMIN')
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('sin asuntos, lo dice y no deja la tarjeta vacía', () => {
    montar([], 'ADMIN')
    expect(screen.getByText(/todo al día/i)).toBeInTheDocument()
  })
})
