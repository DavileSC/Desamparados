import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El módulo recuerda si ya pidió la recarga: cada prueba lo carga de nuevo.
const cargar = async () => {
  vi.resetModules()
  return import('../recargaTrasDespliegue')
}

describe('recarga tras un despliegue', () => {
  const reload = vi.fn()
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('location', { ...window.location, reload })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    reload.mockReset()
  })

  it('reconoce el trozo que no se pudo bajar en cada navegador, y nada más', async () => {
    const { esFalloDeTrozo } = await cargar()
    expect(esFalloDeTrozo(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Agenda-abc.js'))).toBe(true)
    expect(esFalloDeTrozo(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(esFalloDeTrozo(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(esFalloDeTrozo(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(esFalloDeTrozo(null)).toBe(false)
  })

  it('recarga una vez; si vuelve a fallar enseguida, ya no (sin bucles)', async () => {
    const { recargarUnaVez } = await cargar()
    expect(recargarUnaVez(1_000_000)).toBe(true)
    expect(recargarUnaVez(1_000_001)).toBe(true) // el doble pintado de StrictMode
    expect(reload).toHaveBeenCalledTimes(1)

    // Tras la recarga, la página es nueva pero la marca sigue en sessionStorage.
    const nueva = await cargar()
    expect(nueva.recargarUnaVez(1_005_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)

    // Pasado un rato, otro despliegue sí puede recargar.
    const masTarde = await cargar()
    expect(masTarde.recargarUnaVez(1_020_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
