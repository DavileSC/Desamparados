import { describe, it, expect, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import PoliticaDeCookiesPage from '../PoliticaDeCookiesPage'
import PoliticaDePrivacidadPage from '../PoliticaDePrivacidadPage'
import CondicionesDeCompraPage from '../CondicionesDeCompraPage'
import PieDePagina from '../../../components/PieDePagina'
import { laCorporacion } from '../../../domain/articulos'

beforeEach(() => { try { window.localStorage.clear() } catch { /* sin almacenamiento */ } })

describe('páginas legales', () => {
  it('la política de cookies: una tabla con lo que guarda la web; lo de la tienda, solo con la tienda', () => {
    const { unmount } = renderWithProviders(<PoliticaDeCookiesPage />, { modulos: ['tienda-web', 'area-hermanos'] })
    const tablas = screen.getAllByRole('table')
    expect(within(tablas[0]).getByText('desamparados-cookies-consent, desamparados-cookies-consent-fecha')).toBeInTheDocument()
    expect(within(tablas[0]).getByText('tienda-cesta')).toBeInTheDocument()
    expect(within(tablas[0]).getByText('desamparados_hermano')).toBeInTheDocument()
    // Lo de terceros, aparte y diciendo cuándo se carga cada uno.
    expect(within(tablas[1]).getByText('Google Maps')).toBeInTheDocument()
    expect(within(tablas[1]).getByText(/Si se aceptan las cookies, en toda la web/)).toBeInTheDocument()
    unmount()

    renderWithProviders(<PoliticaDeCookiesPage />, { modulos: [] })
    expect(within(screen.getAllByRole('table')[0]).queryByText('tienda-cesta')).not.toBeInTheDocument()
    expect(within(screen.getAllByRole('table')[0]).queryByText('desamparados_hermano')).not.toBeInTheDocument()
  })

  it('la política de cookies deja cambiar la decisión desde la propia página', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('desamparados-cookies-consent', 'accepted')
    renderWithProviders(<PoliticaDeCookiesPage />, { modulos: [] })
    expect(screen.getByText(/Ahora mismo están aceptadas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a decidir' }))
    expect(screen.getByText('Ahora mismo no hay ninguna decisión guardada.')).toBeInTheDocument()
    expect(window.localStorage.getItem('desamparados-cookies-consent')).toBeNull()
  })

  it('la política de privacidad: tienda y donativos solo con sus módulos', () => {
    const { unmount } = renderWithProviders(<PoliticaDePrivacidadPage />, { modulos: ['tienda-web', 'donativos', 'pago-en-linea'] })
    expect(screen.getByRole('heading', { name: 'Compras en la tienda' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Donativos y apadrinamientos' })).toBeInTheDocument()
    expect(screen.getByText(/modelo 182/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3. Pagos en línea' })).toBeInTheDocument()
    unmount()

    renderWithProviders(<PoliticaDePrivacidadPage />, { modulos: [] })
    expect(screen.queryByRole('heading', { name: 'Compras en la tienda' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Pagos en línea/)).not.toBeInTheDocument()
    // Sin pagos, los apartados se numeran seguidos.
    expect(screen.getByRole('heading', { name: '3. A quién se comunican' })).toBeInTheDocument()
    // Lo de los hermanos, siempre, con su base por ser datos de una entidad religiosa.
    expect(screen.getByText(/art\. 9\.2\.d del RGPD/)).toBeInTheDocument()
  })

  it('las condiciones de compra: desistimiento de 14 días y garantía de tres años', () => {
    renderWithProviders(<CondicionesDeCompraPage />, { modulos: ['tienda-web'] })
    expect(screen.getByRole('heading', { level: 1, name: 'Condiciones de compra' })).toBeInTheDocument()
    expect(screen.getByText(/en los 14 días naturales siguientes a la recogida/)).toBeInTheDocument()
    expect(screen.getByText(/garantía legal de conformidad de tres años/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${laCorporacion()} devuelve el importe`))).toBeInTheDocument()
  })

  it('el pie enlaza las condiciones de compra solo con la tienda encendida', () => {
    const { unmount } = renderWithProviders(<PieDePagina />, { modulos: ['tienda-web'] })
    const legal = screen.getByRole('navigation', { name: 'Información legal' })
    expect(within(legal).getByRole('link', { name: 'Condiciones de compra' })).toHaveAttribute('href', '/condiciones-de-compra')
    unmount()

    renderWithProviders(<PieDePagina />, { modulos: [] })
    expect(within(screen.getByRole('navigation', { name: 'Información legal' })).queryByRole('link', { name: 'Condiciones de compra' })).not.toBeInTheDocument()
  })
})
