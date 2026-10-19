import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloqueContacto from '../BloqueContacto'
import type { BloqueContacto as Datos } from '../../../lib/api/contenido'

const lineas = [
  { etiqueta: 'Email', valor: 'secretaria@example.es' },
  { etiqueta: 'Teléfono', valor: '644 90 01 67' },
  { etiqueta: 'Dirección', valor: 'C. Corregidor Paz Guzmán, 13' },
  { etiqueta: 'Horario de Secretaría', valor: 'Primer viernes de cada mes' },
]

const carta = (cambios: Partial<Datos> = {}): Datos => ({
  tipo: 'contacto', titulo: '', tituloDatos: 'Datos de contacto', lineas,
  presentacion: { disposicion: 'carta' },
  ...cambios,
})

describe('BloqueContacto en «Carta»', () => {
  it('va en el orden de una carta: asunto, mensaje y la firma de quien escribe', () => {
    renderWithProviders(<BloqueContacto bloque={carta()} />)

    const campos = ['Asunto', 'Mensaje', 'Nombre', 'Email', 'Teléfono (opcional)'].map((nombre) => screen.getByLabelText(nombre))
    for (let i = 1; i < campos.length; i++) {
      expect(campos[i - 1].compareDocumentPosition(campos[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('al pie, los datos: el correo y el teléfono se pulsan, la dirección y el horario no', () => {
    renderWithProviders(<BloqueContacto bloque={carta()} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Datos de contacto' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'secretaria@example.es' })).toHaveAttribute('href', 'mailto:secretaria@example.es')
    expect(screen.getByRole('link', { name: '644 90 01 67' })).toHaveAttribute('href', 'tel:644900167')
    expect(screen.queryByRole('link', { name: /Corregidor/ })).not.toBeInTheDocument()
    expect(screen.getByText('Primer viernes de cada mes')).toBeInTheDocument()
    // Los datos van después del formulario, no a su lado.
    const enviar = screen.getByRole('button', { name: /enviar mensaje/i })
    expect(enviar.compareDocumentPosition(screen.getByText('Primer viernes de cada mes')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin líneas, solo la carta', () => {
    renderWithProviders(<BloqueContacto bloque={carta({ lineas: [] })} />)
    expect(screen.getByLabelText('Mensaje')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Datos de contacto' })).not.toBeInTheDocument()
  })
})
