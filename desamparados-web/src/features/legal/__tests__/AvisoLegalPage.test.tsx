import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'

// Una instalación de mentira con otro artículo: si el aviso legal sigue
// escribiendo «Grupo» a mano, esta prueba lo nota aunque la de Desamparados
// (con «el Grupo Parroquial» de siempre) no lo habría hecho.
vi.mock('../../../../../shared/datos-entidad.json', () => ({
  default: {
    identidad: {
      nombre: 'Hermandad Nuestra Señora de los Desamparados',
      tipo: 'Hermandad',
      tipoCorto: 'Hermandad',
      articulo: 'la',
      nombreCorto: 'Desamparados',
      titular: 'Nuestra Señora de los Desamparados',
      localidad: 'Málaga',
      dominio: 'www.desamparadosmalaga.com',
      descripcion: 'Hermandad de Nuestra Señora de los Desamparados de Málaga.',
    },
    secretaria: { horario: null, direccion: null, telefono: null, email: 'goretti.desamparados@gmail.com' },
    escudoUrl: null,
  },
}))

describe('AvisoLegalPage con otra instalación', () => {
  it('dice «de la Hermandad» en vez de escribir el Grupo a mano', async () => {
    // Import dinámico: así el mock de arriba (que se iza antes que los imports
    // estáticos) llega a `config/site.ts` y a `domain/articulos.ts` antes de que
    // la página los lea.
    const { default: AvisoLegalPage } = await import('../AvisoLegalPage')
    renderWithProviders(<AvisoLegalPage />)
    expect(await screen.findByText(/información sobre la Hermandad, sus actividades/)).toBeInTheDocument()
    expect(screen.getByText(/son propiedad de la Hermandad o de terceros/)).toBeInTheDocument()
    expect(screen.getByText(/La Hermandad se rige por las/)).toBeInTheDocument()
    // La frase provisional («debe ser revisado… antes de su puesta en producción») ya no sale en público.
    expect(screen.queryByText(/puesta en producción/)).not.toBeInTheDocument()
    // Excepción real y documentada: la denominación jurídica exacta inscrita
    // (config/site.ts) es un dato legal propio, no una frase calculada, y por
    // eso sigue diciendo «Grupo Parroquial» aunque la instalación sea otra.
    expect(screen.getByText('Parroquia Santa María Goretti - Grupo Parroquial Nuestra Señora de los Desamparados')).toBeInTheDocument()
  })
})
