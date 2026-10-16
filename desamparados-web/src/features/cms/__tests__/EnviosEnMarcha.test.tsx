import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import EnviosEnMarcha from '../EnviosEnMarcha'

const respuesta = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

describe('EnviosEnMarcha', () => {
  it('enseña el tope del día y lo que sigue mañana, con lo que fue al móvil', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({
      hoy: { enviados: 250, tope: 250 },
      envios: [{
        clave: 'apertura:3:2027', tipo: 'apertura', titulo: 'Apertura de papeletas · Estación de Penitencia 2027', desde: '2026-10-14T10:00:00.000Z',
        alMovil: 84, enviados: 250, fallidos: 0, rebotados: 0, pendientes: 152, total: 486, estado: 'SIGUE_MANANA',
      }],
    })))
    renderWithProviders(<EnviosEnMarcha />)

    expect(await screen.findByText('Apertura de papeletas · Estación de Penitencia 2027')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '250 de 250 correos' })).toBeInTheDocument()
    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('250 de 402')).toBeInTheDocument()
    expect(screen.getByText('Sigue mañana')).toBeInTheDocument()
    expect(screen.getByText(/Lo que falta sale mañana/)).toBeInTheDocument()
  })

  it('los que rebotaron cuentan en el total por correo y se dicen aparte', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({
      hoy: { enviados: 40, tope: 250 },
      envios: [{
        clave: 'comunicado:9', tipo: 'comunicado', titulo: 'Boletín de octubre', desde: '2026-10-14T10:00:00.000Z',
        alMovil: 0, enviados: 38, fallidos: 0, rebotados: 2, pendientes: 0, total: 40, estado: 'TERMINADO',
      }],
    })))
    renderWithProviders(<EnviosEnMarcha />)

    expect(await screen.findByText('38 de 40')).toBeInTheDocument()
    expect(screen.getByText(/2 rebotados/)).toBeInTheDocument()
  })
})
