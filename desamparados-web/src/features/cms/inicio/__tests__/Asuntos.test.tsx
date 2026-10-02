import { useState } from 'react'
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
    accion: { texto: 'Revisar', href: '/cms/tesoreria' }, modulo: 'nucleo',
  },
  {
    clave: 'noticias-borrador', prioridad: 'pendiente', etiqueta: 'Pendiente',
    titulo: '2 noticias en borrador', detalle: 'Noticias · sin publicar',
    cargo: 'Redes', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
    accion: { texto: 'Publicar', href: '/cms/noticias' }, modulo: 'noticias',
  },
]

// Quien la pone decide si está abierta: aquí, un estado de prueba.
function ConEstado({ tareas, role }: { tareas: Tarea[]; role?: string }) {
  const [todos, setTodos] = useState(false)
  return <Asuntos tareas={tareas} role={role} todos={todos} onTodos={setTodos} />
}
const montar = (tareas: Tarea[], role?: string) =>
  renderWithProviders(<TemaCmsProvider><ConEstado tareas={tareas} role={role} /></TemaCmsProvider>)

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

  const varias = (n: number) => Array.from({ length: n }, (_, i) => ({ ...TAREAS[1], clave: `t${i}`, titulo: `Asunto ${i + 1}` }))

  it('hasta cuatro, se ven todos y sin «Ver los N»', () => {
    montar(varias(4), 'ADMIN')
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /Ver los/ })).not.toBeInTheDocument()
  })

  it('con más de cuatro, enseña tres y el resto con «Ver los N»', async () => {
    const usuario = userEvent.setup()
    montar(varias(6), 'ADMIN')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    await usuario.click(screen.getByRole('button', { name: 'Ver los 6' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    await usuario.click(screen.getByRole('button', { name: 'Ver menos' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('sin asuntos, lo dice', () => {
    montar([], 'ADMIN')
    expect(screen.getByRole('heading', { name: 'Nada pendiente' })).toBeInTheDocument()
    expect(screen.getByText(/todo al día/i)).toBeInTheDocument()
  })
})
