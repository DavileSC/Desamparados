import { describe, it, expect } from 'vitest'
import { DESTINOS_FIJOS, PREFIJO_NOTICIA, esDestinoValido } from '../destinos'
// El fuente del router como texto, como en config/__tests__/navegacion.test.ts.
import fuente from '../../routes/index.tsx?raw'

/** Las rutas reales del router: el bloque público y las absolutas de fuera de él. */
function rutasDelRouter(): Set<string> {
  const inicio = fuente.indexOf('<MarcoPublico />')
  const fin = fuente.indexOf("path: '*'", inicio)
  const publicas = [...fuente.slice(inicio, fin).matchAll(/path:\s*'([^']+)'/g)].map((m) => `/${m[1]}`)
  const absolutas = [...fuente.matchAll(/path:\s*'(\/[^']+)'/g)].map((m) => m[1])
  return new Set(['/', ...publicas, ...absolutas])
}

describe('destinos de los enlaces del CMS', () => {
  it('cada destino que ofrece el selector existe en el router: ninguno lleva a «página no encontrada»', () => {
    const rutas = rutasDelRouter()
    for (const destino of DESTINOS_FIJOS) expect(rutas, destino.ruta).toContain(destino.ruta)
  })

  it('la ruta de una noticia existe en el router', () => {
    expect(rutasDelRouter()).toContain(`${PREFIJO_NOTICIA}:slug`)
  })

  it('una ruta inventada no vale; una noticia, sí', () => {
    expect(esDestinoValido('/hola')).toBe(false)
    expect(esDestinoValido('//otro.test')).toBe(false)
    expect(esDestinoValido('/historia')).toBe(true)
    expect(esDestinoValido(`${PREFIJO_NOTICIA}apertura-del-curso`)).toBe(true)
  })
})
