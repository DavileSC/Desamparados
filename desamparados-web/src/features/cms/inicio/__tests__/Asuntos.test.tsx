import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import Asuntos from '../Asuntos'
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
  renderWithProviders(<TemaCmsProvider><Asuntos tareas={tareas} role={role} /></TemaCmsProvider>)

describe('Asuntos', () => {
  it('cuenta los asuntos y los reparte entre tuyos y del resto de la junta', () => {
    montar(TAREAS, 'REDES')
    expect(screen.getByRole('heading', { name: '2 asuntos esperando' })).toBeInTheDocument()
    expect(screen.getByText('1 tuyo · 1 del resto de la junta')).toBeInTheDocument()
  })

  it('el que lleva el asunto ve el enlace; lo del resto, con quién lo lleva', () => {
    montar(TAREAS, 'REDES')
    expect(screen.getByRole('link', { name: /Publicar/ })).toHaveAttribute('href', '/cms/noticias')
    expect(screen.getByText('Lo lleva Tesorería')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Revisar/ })).not.toBeInTheDocument()
  })

  it('el Hermano Mayor ve todos los enlaces y ningún «lo lleva»', () => {
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

  it('con muchos, enseña cuatro y el resto con «Ver los N»', async () => {
    const muchas = Array.from({ length: 6 }, (_, i) => ({ ...TAREAS[1], clave: `t${i}`, titulo: `Asunto ${i + 1}` }))
    montar(muchas, 'ADMIN')
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver los 6' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })

  it('sin asuntos, lo dice', () => {
    montar([], 'ADMIN')
    expect(screen.getByRole('heading', { name: 'Nada pendiente' })).toBeInTheDocument()
    expect(screen.getByText(/todo al día/i)).toBeInTheDocument()
  })
})
