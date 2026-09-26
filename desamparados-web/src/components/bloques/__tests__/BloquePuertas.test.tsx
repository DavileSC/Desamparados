import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquePuertas from '../BloquePuertas'
import type { BloquePuertas as Datos, Puerta } from '../../../lib/api/contenido'

const PUERTA: Puerta = {
  ceja: 'Si lo necesitas', titulo: 'Necesito ayuda', texto: 'Acude a Cáritas.',
  datos: [{ etiqueta: 'Despacho', valor: 'Martes y viernes', nota: '18:00 – 20:00', copiable: false }],
  boton: 'Cómo llegar', enlace: '/contacto',
}
const bloque = (segunda: Partial<Puerta>): Datos => ({ tipo: 'puertas', titulo: '', puertas: [PUERTA, { ...PUERTA, titulo: 'Quiero ayudar', ...segunda }] })

describe('BloquePuertas', () => {
  it('pinta las dos puertas con sus datos y su botón', () => {
    renderWithProviders(<BloquePuertas bloque={bloque({})} />)
    expect(screen.getByRole('heading', { name: 'Necesito ayuda' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quiero ayudar' })).toBeInTheDocument()
    expect(screen.getAllByText('Martes y viernes')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /Cómo llegar/ })[0]).toHaveAttribute('href', '/contacto')
  })

  it('un dato sin valor no sale: el donativo espera sin dejar hueco', () => {
    renderWithProviders(<BloquePuertas bloque={bloque({ datos: [{ etiqueta: 'Donativo', valor: '', nota: '', copiable: true }] })} />)
    expect(screen.queryByText('Donativo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Copiar/ })).not.toBeInTheDocument()
  })

  it('un dato copiable lleva su botón, que copia el valor', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderWithProviders(<BloquePuertas bloque={bloque({ datos: [{ etiqueta: 'Donativo', valor: 'ES00 1234', nota: '', copiable: true }] })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar donativo' }))
    expect(writeText).toHaveBeenCalledWith('ES00 1234')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Donativo: copiado' })).toBeInTheDocument())
  })

  it('un botón sin destino válido no se pinta', () => {
    renderWithProviders(<BloquePuertas bloque={bloque({ boton: 'Escríbenos', enlace: '/no-existe' })} />)
    expect(screen.queryByRole('link', { name: /Escríbenos/ })).not.toBeInTheDocument()
  })
})
