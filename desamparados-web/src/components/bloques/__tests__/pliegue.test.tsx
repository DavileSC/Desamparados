import { afterEach, describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import type { Bloque } from '../../../lib/api/contenido'

/** Las secciones plegables de Patrimonio (27-11-2026). */
const BLOQUES: Bloque[] = [
  { tipo: 'texto', titulo: '', html: '<p>Antes de las partes.</p>' },
  { tipo: 'pliegue', titulo: 'El trono', resumen: 'La pieza mayor.', presentacion: { ancla: 'trono' } },
  { tipo: 'datos', titulo: 'Ficha', lineas: [{ etiqueta: 'Procedencia', valor: 'Archicofradía' }] },
  { tipo: 'pliegue', titulo: 'Enseres', resumen: '', presentacion: { ancla: 'enseres' } },
  { tipo: 'texto', titulo: '', html: '<p>Los enseres.</p>' },
]

const boton = (nombre: string) => screen.getByRole('button', { name: new RegExp(`^${nombre}`) })

describe('las secciones plegables', () => {
  afterEach(() => { window.location.hash = '' })

  it('abren la primera; al abrir otra, se cierra la que estaba', async () => {
    renderWithProviders(<BloquesDePagina bloques={BLOQUES} />)
    expect(screen.getByText('Antes de las partes.')).toBeVisible()
    expect(boton('El trono')).toHaveAttribute('aria-expanded', 'true')
    expect(boton('Enseres')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(boton('Enseres'))
    expect(boton('Enseres')).toHaveAttribute('aria-expanded', 'true')
    expect(boton('El trono')).toHaveAttribute('aria-expanded', 'false')
  })

  it('dentro de una parte, el título de un bloque es un subtítulo', () => {
    renderWithProviders(<BloquesDePagina bloques={BLOQUES} />)
    expect(screen.getByRole('heading', { name: 'Ficha', level: 3 })).toBeInTheDocument()
  })

  it('una dirección con el ancla de un pliegue abre su parte', () => {
    window.location.hash = '#enseres'
    renderWithProviders(<BloquesDePagina bloques={BLOQUES} />)
    expect(boton('Enseres')).toHaveAttribute('aria-expanded', 'true')
    expect(boton('El trono')).toHaveAttribute('aria-expanded', 'false')
  })
})
