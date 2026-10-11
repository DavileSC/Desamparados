import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'

// Una instalación de mentira en plural, con otra advocación y otra localidad:
// el artículo «las» también dice el número, así que el verbo de la frase en
// que la corporación es el sujeto tiene que ir en plural; y lo que antes se
// escribía de Desamparados («Nuestra Señora de los Desamparados», «Málaga»)
// tiene que salir de la identidad.
vi.mock('../../../config/instalacion', () => ({
  faltaInstalacion: false,
  instalacion: {
    identidad: {
      nombre: 'Cofradías Fusionadas de Nuestra Señora de la Paz',
      tipo: 'Cofradías Fusionadas',
      tipoCorto: 'Cofradías',
      articulo: 'las',
      nombreCorto: 'Fusionadas',
      titular: 'Nuestra Señora de la Paz',
      localidad: 'Antequera',
      dominio: 'www.fusionadas.ejemplo',
      descripcion: 'Cofradías de ejemplo, para las pruebas.',
      denominacion: null,
      domicilio: null,
      normas: { titulo: 'las normas diocesanas', url: 'https://normas.ejemplo/normas.pdf' },
    },
    marca: { colorPrincipal: null, colorAcento: null },
  },
}))

const descripcion = () => document.head.querySelector('meta[name="description"]')?.getAttribute('content')

// Imports dinámicos: así el mock de arriba (que se iza antes que los imports
// estáticos) llega a `config/site.ts` y a `domain/articulos.ts` antes de que
// la página los lea.
describe('otra instalación, en plural', () => {
  it('el aviso legal: «se rigen» y la descripción con su advocación y su localidad', async () => {
    const { default: AvisoLegalPage } = await import('../AvisoLegalPage')
    renderWithProviders(<AvisoLegalPage />)
    expect((await screen.findByRole('link', { name: 'las normas diocesanas' })).closest('p')).toHaveTextContent('Las Cofradías Fusionadas se rigen por las normas diocesanas.')
    await waitFor(() => expect(descripcion()).toBe(
      'Datos identificativos de las Cofradías Fusionadas de Nuestra Señora de la Paz de Antequera y condiciones de uso de esta web, conforme a la LSSI-CE.',
    ))
  })

  it('la política de privacidad: «tratan» y la descripción con su advocación', async () => {
    const { default: PoliticaDePrivacidadPage } = await import('../PoliticaDePrivacidadPage')
    renderWithProviders(<PoliticaDePrivacidadPage />)
    await waitFor(() => expect(descripcion()).toMatch(/^Qué datos personales tratan las Cofradías Fusionadas de Nuestra Señora de la Paz, con qué finalidad/))
    expect(descripcion()).not.toMatch(/Desamparados/)
  })

  it('hazte hermano: la descripción con su advocación, no la de Desamparados', async () => {
    const { default: HazteHermanoPage } = await import('../../altas/public/HazteHermanoPage')
    renderWithProviders(<HazteHermanoPage />, { routerDeDatos: true })
    await waitFor(() => expect(descripcion()).toMatch(/^Solicita tu alta como hermano de las Cofradías Fusionadas de Nuestra Señora de la Paz\./))
  })
})
