import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import AltasRetenidas from '../AltasRetenidas'
import type { AltaRetenida } from '../../../../lib/api/hermanos'

const RETENIDA: AltaRetenida = {
  id: 7,
  creadaEl: '2026-11-09T10:00:00.000Z',
  nombre: 'Javier', apellidos: 'Ruiz Montes', email: 'javier@ejemplo.es', telefono: '661223344',
  personas: [
    { quien: 'adulto', nombre: 'Javier', apellidos: 'Ruiz Montes', dni: '12345678Z', fechaNacimiento: '1986-11-03', seHaceHermano: true },
    { quien: 0, nombre: 'Luis', apellidos: 'Ruiz Pérez', dni: null, fechaNacimiento: '2013-01-01', seHaceHermano: true },
  ],
  choques: [{
    quien: 'adulto', motivo: 'dni_en_el_censo', dni: '12345678Z',
    con: { tipo: 'ficha', id: 42, numeroHermano: 214, nombre: 'Ana', apellidos: 'Pérez', situacion: 'baja', fechaBaja: '2023-02-03T00:00:00.000Z' },
  }],
}

describe('AltasRetenidas', () => {
  it('dice con quién choca el DNI y solo deja tramitar con el DNI corregido', async () => {
    // Se rompe si se puede tramitar sin corregir el DNI (el servidor lo pararía
    // con un 409 sin sentido) o si el aviso deja de decir a quién mirar.
    const onTramitar = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<AltasRetenidas retenidas={[RETENIDA]} ocupado={false} onTramitar={onTramitar} onDescartar={vi.fn()} />)

    expect(screen.getByText(/El DNI 12345678Z ya está en el censo: Ana Pérez, n\.º 214, de baja desde el 3\/2\/2023/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver la ficha' })).toHaveAttribute('href', '/cms/hermanos?ficha=42')

    const tramitar = screen.getByRole('button', { name: 'Tramitar con el DNI corregido' })
    expect(tramitar).toBeDisabled()
    // Solo pide el DNI de quien choca: el menor sin choque no tiene campo.
    expect(screen.getAllByRole('textbox')).toHaveLength(1)

    await userEvent.type(screen.getByRole('textbox', { name: 'DNI correcto de Javier' }), '87654321x')
    await userEvent.click(tramitar)
    expect(onTramitar).toHaveBeenCalledWith(RETENIDA, { adulto: '87654321X' })
  })

  it('descartar pide confirmación antes de borrar', async () => {
    const onDescartar = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<AltasRetenidas retenidas={[RETENIDA]} ocupado={false} onTramitar={vi.fn()} onDescartar={onDescartar} />)

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(onDescartar).not.toHaveBeenCalled()
    await userEvent.click(screen.getAllByRole('button', { name: 'Descartar' }).at(-1)!)
    expect(onDescartar).toHaveBeenCalledWith(RETENIDA)
  })

  it('sin retenidas no pinta nada', () => {
    const { container } = renderWithProviders(<AltasRetenidas retenidas={[]} ocupado={false} onTramitar={vi.fn()} onDescartar={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
