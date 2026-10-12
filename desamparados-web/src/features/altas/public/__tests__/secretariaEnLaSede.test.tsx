import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { DATOS } from '../../../../test/instalacion'
import { secretariaEnLaSede } from '../secretariaEnLaSede'
import ProcesoAlta from '../ProcesoAlta'
import SolicitudRecibida from '../SolicitudRecibida'

const sede = { nombre: 'Casa Hermandad', calle: 'Calle Real, 4', codigoPostal: null, localidad: null }

describe('a dónde se va a formalizar el alta', () => {
  it('Secretaría con la sede de los datos de contacto', () => {
    expect(secretariaEnLaSede(sede)).toBe('Secretaría (Casa Hermandad, Calle Real, 4)')
    expect(secretariaEnLaSede({ ...sede, calle: null })).toBe('Secretaría (Casa Hermandad)')
    expect(secretariaEnLaSede({ ...sede, nombre: '  ' })).toBe('Secretaría (Calle Real, 4)')
  })

  it('sin sede, o mientras llega, solo Secretaría: la frase sigue entera', () => {
    expect(secretariaEnLaSede({ nombre: null, calle: null, codigoPostal: null, localidad: null })).toBe('Secretaría')
    expect(secretariaEnLaSede(undefined)).toBe('Secretaría')
  })

  // Las pruebas siembran el contacto del ejemplo (test/queryClient.ts): la
  // sede sale de ahí y ya no se lee «casa parroquial», que solo vale para
  // una corporación con sede en una parroquia.
  const esperada = `${secretariaEnLaSede(DATOS.sede)} con`

  it('el lateral del alta lleva a Secretaría, en la sede', () => {
    const { container } = renderWithProviders(<ProcesoAlta />)
    expect(container.textContent).toContain(`pásate por ${esperada} tu DNI`)
    expect(container.textContent).not.toMatch(/casa parroquial/i)
  })

  it('la solicitud enviada lleva a Secretaría, en la sede', () => {
    const { container } = renderWithProviders(<SolicitudRecibida nombre="Ana" email="ana@example.com" />)
    expect(screen.getByText(/Qué toca ahora/)).toBeInTheDocument()
    expect(container.textContent).toContain(`pasarse por ${esperada} el DNI`)
    expect(container.textContent).not.toMatch(/casa parroquial/i)
  })
})
