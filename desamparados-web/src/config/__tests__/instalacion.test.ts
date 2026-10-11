import { describe, it, expect, vi, afterEach } from 'vitest'
import { INSTALACION } from '../../test/instalacion'

// config/instalacion.ts lee window.__INSTALACION__ al importarse, una vez:
// cada prueba lo importa de nuevo con lo que toque en window.
const importar = async () => {
  vi.resetModules()
  return import('../instalacion')
}

afterEach(() => {
  window.__INSTALACION__ = INSTALACION
  vi.restoreAllMocks()
})

describe('los datos de la instalación en la web', () => {
  it('toma los que deja /instalacion.js en window', async () => {
    const { instalacion, faltaInstalacion } = await importar()
    expect(faltaInstalacion).toBe(false)
    expect(instalacion).toEqual(INSTALACION)
  })

  it('sin /instalacion.js no lanza al importarse, lo marca y pinta el aviso en vez de la web', async () => {
    delete window.__INSTALACION__
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { instalacion, faltaInstalacion, avisarSinInstalacion, AVISO_SIN_INSTALACION } = await importar()
    expect(faltaInstalacion).toBe(true)
    // Vacía y con la forma de siempre: lo que la importe no revienta.
    expect(instalacion.identidad.nombre).toBe('')
    expect(instalacion.identidad.articulo).toBe('el')
    // Y el resto de la web tampoco al importarse.
    await expect(import('../site')).resolves.toBeDefined()
    await expect(import('../../domain/articulos')).resolves.toBeDefined()

    const raiz = document.createElement('div')
    raiz.innerHTML = '<p>lo de antes</p>'
    avisarSinInstalacion(raiz)
    expect(raiz).toHaveTextContent(AVISO_SIN_INSTALACION)
    expect(raiz).not.toHaveTextContent('lo de antes')
    expect(raiz.querySelector('[role="alert"]')).not.toBeNull()
    expect(error).toHaveBeenCalled()
  })
})
