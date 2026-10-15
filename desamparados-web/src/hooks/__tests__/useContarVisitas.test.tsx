import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderWithProviders } from '../../test/test-utils'
import { procedenciaDeFuera, urlDeVisita, useContarVisitas } from '../useContarVisitas'

function Pagina() {
  useContarVisitas()
  return <Link to="/noticias/la-cuaresma">Noticia</Link>
}

const enviadas = vi.fn((_url: string) => true)

beforeEach(() => {
  enviadas.mockClear()
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { sendBeacon: enviadas, doNotTrack: null }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('contar las páginas vistas', () => {
  it('avisa de cada página, también al moverse sin recargar', async () => {
    renderWithProviders(<Pagina />, { ruta: '/historia', modulos: ['estadisticas-de-visitas'] })
    expect(enviadas).toHaveBeenCalledWith('/visita?ruta=/historia')
    await userEvent.click(screen.getByRole('link', { name: 'Noticia' }))
    expect(enviadas).toHaveBeenLastCalledWith('/visita?ruta=/noticias/la-cuaresma')
    expect(enviadas).toHaveBeenCalledTimes(2)
  })

  it('con el módulo apagado no avisa de nada', () => {
    renderWithProviders(<Pagina />, { ruta: '/historia', modulos: [] })
    expect(enviadas).not.toHaveBeenCalled()
  })

  it('a quien pide no ser seguido no se le cuenta', () => {
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { sendBeacon: enviadas, globalPrivacyControl: true }))
    renderWithProviders(<Pagina />, { ruta: '/historia', modulos: ['estadisticas-de-visitas'] })
    expect(enviadas).not.toHaveBeenCalled()
  })

  it('la ruta va sin consulta y sin nada que parta la de /visita', () => {
    expect(urlDeVisita('/a&b c', 'https://www.google.com/')).toBe('/visita?ruta=/a%26b%20c&ref=https://www.google.com/')
    // Ya viene codificada del navegador: no se codifica dos veces.
    expect(urlDeVisita('/cofrad%C3%ADa', null)).toBe('/visita?ruta=/cofrad%C3%ADa')
  })

  it('de la procedencia solo el sitio, y nada si es esta misma web', () => {
    expect(procedenciaDeFuera('https://www.google.com/search?q=desamparados', 'desamparadosmalaga.com')).toBe('https://www.google.com/')
    expect(procedenciaDeFuera('https://desamparadosmalaga.com/agenda', 'desamparadosmalaga.com')).toBeNull()
    expect(procedenciaDeFuera('', 'desamparadosmalaga.com')).toBeNull()
    expect(procedenciaDeFuera('android-app://com.google.android.gm/', 'desamparadosmalaga.com')).toBeNull()
  })
})
