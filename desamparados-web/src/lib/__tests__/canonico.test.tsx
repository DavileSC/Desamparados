import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import MetaDePagina from '../../components/MetaDePagina'
import { QuitarCanonico } from '../canonico'

describe('canonical de las páginas sin indexar', () => {
  it('una página con noindex pide quitar el canonical mientras está montada; las demás no', () => {
    const quitar = vi.fn()
    const pintar = (sinIndexar: boolean) => (
      <HelmetProvider><QuitarCanonico.Provider value={quitar}><MetaDePagina titulo="Página no encontrada" sinIndexar={sinIndexar} /></QuitarCanonico.Provider></HelmetProvider>
    )
    const { rerender, unmount } = render(pintar(false))
    expect(quitar).not.toHaveBeenCalled()
    rerender(pintar(true))
    expect(quitar).toHaveBeenLastCalledWith(true)
    unmount()
    expect(quitar).toHaveBeenLastCalledWith(false)
  })
})
